import { computed, onMounted, ref, watch } from "vue";
import {
  ROOT_PATH,
  assertValidName,
  buildBreadcrumbs,
  createFolder,
  deleteFolder,
  deleteImage,
  ensureRootFolder,
  getParentPath,
  listAllFolders,
  listFolderContent,
  moveImages,
  rebuildFolderImageCounts,
  renameFolder,
  renameImage,
  uploadImageToCloud,
} from "@/utils/cloud";
import {
  FOLDER_THUMB_BASE64,
  PAGE_SIZE,
  PLACEHOLDER_BASE64,
  SORT_OPTIONS,
} from "./constants";
import {
  debounce,
  getLocalFileName,
  showError,
  withLoading,
} from "./helpers";

function useGalleryPage() {
  const currentPath = ref(ROOT_PATH);
  const breadcrumbs = ref([{ name: "root", path: ROOT_PATH }]);
  const folderList = ref([]);
  const imageList = ref([]);
  const folderTotal = ref(0);
  const imageTotal = ref(0);
  const loading = ref(false);
  const refreshing = ref(false);
  const searchKeyword = ref("");
  const sortIndex = ref(0);

  const selectionMode = ref(false);
  const selectedItems = ref([]);
  const isDeleting = ref(false);
  const isMoving = ref(false);

  const movePanelVisible = ref(false);
  const folderOptions = ref([]);
  const pendingMoveItems = ref([]);
  const moveTargetPath = ref("");

  const pageSize = ref(PAGE_SIZE);
  const currentPage = ref(1);
  const loadingMore = ref(false);
  const suppressFilterWatch = ref(false);
  const sortOptions = SORT_OPTIONS;

  const gridItems = computed(() => [
    ...folderList.value.map((folder) => ({
      type: "folder",
      ...folder,
      thumb: FOLDER_THUMB_BASE64,
    })),
    ...imageList.value.map((image, index) => ({
      type: "image",
      ...image,
      thumb: image.previewUrl,
      imageIndex: index,
    })),
  ]);

  const hasMore = computed(() => imageList.value.length < imageTotal.value);
  const selectedIds = computed(() => selectedItems.value.map((item) => item._id));
  const showNoMore = computed(() => imageList.value.length > 0);
  const previewUrls = computed(() =>
    imageList.value.map((item) => item.previewUrl).filter(Boolean),
  );

  const emptyText = computed(() => {
    if (searchKeyword.value.trim()) {
      return {
        icon: "🔎",
        text: "没有匹配结果",
        hint: "换个关键词试试",
      };
    }

    if (currentPath.value === ROOT_PATH) {
      return {
        icon: "📂",
        text: "还没有任何内容",
        hint: "点击上传按钮添加图片，或新建分组",
      };
    }

    return {
      icon: "📂",
      text: "当前分组下暂无内容",
      hint: "点击上传按钮添加图片",
    };
  });

  const contentSummary = computed(() => {
    const loadedText = imageTotal.value > imageList.value.length
      ? `，已加载 ${imageList.value.length}/${imageTotal.value} 张图片`
      : "";
    const total = `${folderTotal.value} 个分组 · ${imageTotal.value} 张图片${loadedText}`;

    if (!searchKeyword.value.trim()) {
      return total;
    }

    return `当前匹配 ${total}`;
  });

  const getListQueryOptions = (page = 1) => ({
    page,
    pageSize: pageSize.value,
    keyword: searchKeyword.value,
    sortBy: sortOptions[sortIndex.value]?.value || "default",
  });

  const loadCurrentContent = async (options = {}) => {
    const append = Boolean(options.append);
    const nextPage = append ? currentPage.value + 1 : 1;

    if (append && (loadingMore.value || !hasMore.value)) {
      return;
    }

    try {
      if (append) {
        loadingMore.value = true;
      } else if (!refreshing.value) {
        loading.value = true;
      }

      const { folders, images, pagination } = await listFolderContent(
        currentPath.value,
        getListQueryOptions(nextPage),
      );

      if (append) {
        imageList.value = imageList.value.concat(images);
        currentPage.value = nextPage;
      } else {
        folderList.value = folders;
        imageList.value = images;
        currentPage.value = 1;
      }

      folderTotal.value = pagination?.folderTotal || folders.length;
      imageTotal.value = pagination?.imageTotal || imageList.value.length;
      breadcrumbs.value = buildBreadcrumbs(currentPath.value);
    } catch (error) {
      showError(error, "加载失败");
    } finally {
      loading.value = false;
      loadingMore.value = false;
      refreshing.value = false;
    }
  };

  const bootstrap = async () => {
    try {
      loading.value = true;
      await ensureRootFolder();
      await loadCurrentContent();
    } catch (error) {
      showError(error, "初始化失败");
    } finally {
      loading.value = false;
    }
  };

  const onRefresh = async () => {
    refreshing.value = true;
    await loadCurrentContent();
  };

  const enterFolder = async (path) => {
    if (!path || currentPath.value === path) {
      return;
    }

    cancelSelection();
    suppressFilterWatch.value = true;
    searchKeyword.value = "";
    currentPath.value = path;
    await loadCurrentContent();
    suppressFilterWatch.value = false;
  };

  const goBack = async () => {
    if (currentPath.value === ROOT_PATH) {
      return;
    }

    cancelSelection();
    suppressFilterWatch.value = true;
    searchKeyword.value = "";
    currentPath.value = getParentPath(currentPath.value);
    await loadCurrentContent();
    suppressFilterWatch.value = false;
  };

  const handleSortChange = (value) => {
    sortIndex.value = Number(value || 0);
  };

  const handleCreateFolder = async () => {
    const modal = await uni.showModal({
      title: "新建分组",
      editable: true,
      placeholderText: "请输入分组名称",
    });

    if (!modal.confirm) {
      return;
    }

    const folderName = (modal.content || "").trim();

    try {
      assertValidName(folderName, "分组名称");
    } catch (error) {
      showError(error, "分组名称无效");
      return;
    }

    try {
      await createFolder(currentPath.value, folderName);
      uni.showToast({ title: "创建成功", icon: "success" });
      await loadCurrentContent();
    } catch (error) {
      showError(error, "创建失败");
    }
  };

  const handleUpload = async () => {
    try {
      const pickRes = await uni.chooseImage({
        count: 9,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
      });
      const tempFiles = pickRes.tempFiles || [];
      const files = (pickRes.tempFilePaths || [])
        .map((filePath, index) => ({
          path: filePath,
          name: tempFiles[index]?.name || getLocalFileName(filePath),
          size: tempFiles[index]?.size || 0,
        }))
        .filter((file) => file.path);

      if (!files.length) {
        return;
      }

      let completed = 0;
      uni.showLoading({ title: `上传中 0/${files.length}`, mask: true });

      const results = await Promise.allSettled(
        files.map((file) =>
          uploadImageToCloud(
            file.path,
            currentPath.value,
            file.name,
            { size: file.size },
          ).finally(() => {
            completed++;
            uni.showLoading({
              title: `上传中 ${completed}/${files.length}`,
              mask: true,
            });
          }),
        ),
      );

      uni.hideLoading();

      const succeeded = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.filter((result) => result.status === "rejected").length;

      if (failed === 0) {
        uni.showToast({ title: "上传完成", icon: "success" });
      } else if (succeeded === 0) {
        uni.showToast({ title: "上传失败", icon: "none" });
      } else {
        uni.showToast({
          title: `上传完成，${succeeded} 成功，${failed} 失败`,
          icon: "none",
        });
      }

      await loadCurrentContent();
    } catch (error) {
      uni.hideLoading();
      showError(error, "上传失败");
    }
  };

  const handleGridItemClick = (item) => {
    if (selectionMode.value) {
      if (item.type === "image") {
        toggleSelection(item);
      }
      return;
    }

    if (item.type === "folder") {
      enterFolder(item.path);
    } else if (item.type === "image") {
      previewImage(item.imageIndex);
    }
  };

  const previewImage = (index) => {
    if (!previewUrls.value.length) {
      return;
    }

    uni.previewImage({
      current: previewUrls.value[index] || previewUrls.value[0],
      urls: previewUrls.value,
    });
  };

  const loadMoreInternal = () => {
    if (loadingMore.value || !hasMore.value) {
      return;
    }
    loadCurrentContent({ append: true });
  };

  const loadMore = debounce(loadMoreInternal, 200);

  const handleImageError = (item) => {
    if (item.type !== "image") {
      return;
    }

    const image = imageList.value.find((img) => img._id === item._id);
    if (image) {
      image.previewUrl = PLACEHOLDER_BASE64;
    }
  };

  const handleLongPress = async (item) => {
    uni.vibrateShort({ type: "medium" });

    if (item.type === "image") {
      await handleImageLongPress(item);
    } else if (item.type === "folder") {
      await handleFolderLongPress(item);
    }
  };

  const handleImageLongPress = async (item) => {
    if (selectionMode.value) {
      return;
    }

    try {
      const res = await uni.showActionSheet({
        itemList: ["重命名图片", "移动图片", "删除图片", "进入选择模式"],
      });

      if (res.tapIndex === 0) {
        await handleRenameImage(item);
      } else if (res.tapIndex === 1) {
        await openMovePanel([item]);
      } else if (res.tapIndex === 2) {
        await handleDeleteImage(item);
      } else if (res.tapIndex === 3) {
        enterSelectionMode(item);
      }
    } catch (error) {
      // 用户取消操作，不需要处理
    }
  };

  const handleFolderLongPress = async (item) => {
    if (item.path === ROOT_PATH) {
      uni.showToast({ title: "根目录不能删除", icon: "none" });
      return;
    }

    try {
      const res = await uni.showActionSheet({
        itemList: ["重命名分组", "删除分组"],
      });

      if (res.tapIndex === 0) {
        await handleRenameFolder(item);
      } else if (res.tapIndex === 1) {
        const modal = await uni.showModal({
          title: "确认删除",
          content: `确定要删除分组"${item.name}"吗？只能删除空分组。`,
        });
        if (modal.confirm) {
          await handleDeleteFolder(item);
        }
      }
    } catch (error) {
      // 用户取消操作，不需要处理
    }
  };

  const enterSelectionMode = (item) => {
    selectionMode.value = true;
    selectedItems.value = [item];
  };

  const toggleSelection = (item) => {
    const index = selectedItems.value.findIndex((selected) => selected._id === item._id);
    if (index > -1) {
      selectedItems.value.splice(index, 1);
    } else {
      selectedItems.value.push(item);
    }
  };

  const cancelSelection = () => {
    selectionMode.value = false;
    selectedItems.value = [];
  };

  const batchDelete = async () => {
    if (selectedItems.value.length === 0 || isDeleting.value) {
      return;
    }

    const modal = await uni.showModal({
      title: "确认删除",
      content: `确定要删除选中的 ${selectedItems.value.length} 张图片吗？`,
    });

    if (!modal.confirm) {
      return;
    }

    try {
      isDeleting.value = true;
      uni.showLoading({ title: "删除中", mask: true });
      const results = await Promise.allSettled(
        selectedItems.value.map((item) => deleteImage(item._id, item.cloudFileId)),
      );
      const failed = results.filter((result) => result.status === "rejected").length;
      uni.hideLoading();

      if (failed === 0) {
        uni.showToast({ title: "删除成功", icon: "success" });
      } else {
        uni.showToast({
          title: `删除完成，${failed} 项失败`,
          icon: "none",
        });
      }

      cancelSelection();
      await loadCurrentContent();
    } catch (error) {
      uni.hideLoading();
      showError(error, "删除失败");
    } finally {
      isDeleting.value = false;
    }
  };

  const handleRenameImage = async (item) => {
    const modal = await uni.showModal({
      title: "重命名图片",
      editable: true,
      placeholderText: "请输入图片名称",
      content: item.name || "",
    });

    if (!modal.confirm) {
      return;
    }

    try {
      await withLoading("重命名中", async () => {
        await renameImage(item._id, modal.content || "");
      });
      uni.showToast({ title: "重命名成功", icon: "success" });
      await loadCurrentContent();
    } catch (error) {
      showError(error, "重命名失败");
    }
  };

  const handleRenameFolder = async (item) => {
    const modal = await uni.showModal({
      title: "重命名分组",
      editable: true,
      placeholderText: "请输入分组名称",
      content: item.name || "",
    });

    if (!modal.confirm) {
      return;
    }

    try {
      let nextPath = currentPath.value;
      await withLoading("重命名中", async () => {
        nextPath = await renameFolder(item.path, modal.content || "");
      });

      if (currentPath.value === item.path) {
        currentPath.value = nextPath;
      }

      uni.showToast({ title: "重命名成功", icon: "success" });
      await loadCurrentContent();
    } catch (error) {
      showError(error, "重命名失败");
    }
  };

  const openMovePanel = async (items) => {
    const imageItems = items.filter((item) => item.type === "image");

    if (!imageItems.length || isMoving.value) {
      return;
    }

    try {
      pendingMoveItems.value = imageItems;
      moveTargetPath.value = "";
      folderOptions.value = await listAllFolders();
      movePanelVisible.value = true;
    } catch (error) {
      showError(error, "加载分组失败");
    }
  };

  const selectMoveTarget = (folder) => {
    if (!folder || folder.path === currentPath.value) {
      return;
    }
    moveTargetPath.value = folder.path;
  };

  const closeMovePanel = () => {
    if (isMoving.value) {
      return;
    }
    movePanelVisible.value = false;
    moveTargetPath.value = "";
    pendingMoveItems.value = [];
  };

  const confirmMove = async () => {
    if (!moveTargetPath.value || isMoving.value) {
      return;
    }

    try {
      isMoving.value = true;
      uni.showLoading({ title: "移动中", mask: true });
      await moveImages(
        pendingMoveItems.value.map((item) => item._id),
        moveTargetPath.value,
      );
      uni.hideLoading();
      uni.showToast({ title: "移动成功", icon: "success" });
      movePanelVisible.value = false;
      moveTargetPath.value = "";
      pendingMoveItems.value = [];
      cancelSelection();
      await loadCurrentContent();
    } catch (error) {
      uni.hideLoading();
      showError(error, "移动失败");
    } finally {
      isMoving.value = false;
    }
  };

  const handleDeleteImage = async (item) => {
    try {
      await withLoading("删除中", async () => {
        await deleteImage(item._id, item.cloudFileId);
      });
      uni.showToast({ title: "删除成功", icon: "success" });
      await loadCurrentContent();
    } catch (error) {
      showError(error, "删除失败");
    }
  };

  const handleDeleteFolder = async (item) => {
    try {
      await withLoading("删除中", async () => {
        await deleteFolder(item.path);
      });
      uni.showToast({ title: "删除成功", icon: "success" });
      await loadCurrentContent();
    } catch (error) {
      showError(error, "删除失败");
    }
  };

  const handleRebuildCounts = async () => {
    const modal = await uni.showModal({
      title: "重建图片数",
      content: "将重新统计所有分组的直属图片数量，用于修复历史数据或异常计数。",
    });

    if (!modal.confirm) {
      return;
    }

    try {
      const result = await withLoading("统计中", () => rebuildFolderImageCounts());
      uni.showToast({
        title: `已统计 ${result.folderTotal} 个分组`,
        icon: "none",
      });
      await loadCurrentContent();
    } catch (error) {
      showError(error, "重建失败");
    }
  };

  const reloadWithFilters = debounce(() => {
    cancelSelection();
    currentPage.value = 1;
    loadCurrentContent();
  }, 350);

  watch([searchKeyword, sortIndex], () => {
    if (suppressFilterWatch.value) {
      return;
    }
    reloadWithFilters();
  });

  onMounted(() => {
    bootstrap();
  });

  return {
    ROOT_PATH,
    batchDelete,
    breadcrumbs,
    cancelSelection,
    closeMovePanel,
    confirmMove,
    contentSummary,
    currentPath,
    emptyText,
    enterFolder,
    folderOptions,
    goBack,
    gridItems,
    handleCreateFolder,
    handleGridItemClick,
    handleImageError,
    handleLongPress,
    handleRebuildCounts,
    handleSortChange,
    handleUpload,
    hasMore,
    isDeleting,
    isMoving,
    loadCurrentContent,
    loadMore,
    loading,
    loadingMore,
    movePanelVisible,
    moveTargetPath,
    onRefresh,
    openMovePanel,
    pendingMoveItems,
    refreshing,
    searchKeyword,
    selectMoveTarget,
    selectedIds,
    selectedItems,
    selectionMode,
    showNoMore,
    sortIndex,
    sortOptions,
  };
}

export { useGalleryPage };
