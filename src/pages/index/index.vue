<template>
  <view class="page">
    <view class="header">
      <view class="toolbar">
        <view
          class="btn btn-back"
          :class="{ disabled: currentPath === ROOT_PATH }"
          @click="goBack"
        >
          <text class="btn-icon">←</text>
          <text class="btn-text">返回</text>
        </view>
        <view class="btn btn-create" @click="handleCreateFolder">
          <text class="btn-icon">+</text>
          <text class="btn-text">新建</text>
        </view>
        <view class="btn btn-upload" @click="handleUpload">
          <text class="btn-icon">↑</text>
          <text class="btn-text">上传</text>
        </view>
        <view class="btn btn-refresh" @click="loadCurrentContent">
          <text class="btn-icon">⟳</text>
        </view>
      </view>

      <view class="breadcrumb">
        <text class="breadcrumb-icon">📁</text>
        <view class="breadcrumb-path">
          <text
            v-for="(item, idx) in breadcrumbs"
            :key="item.path"
            class="crumb"
            :class="{ active: idx === breadcrumbs.length - 1 }"
            @click="enterFolder(item.path)"
          >
            {{ item.name }}
            <text v-if="idx < breadcrumbs.length - 1" class="separator">›</text>
          </text>
        </view>
      </view>
    </view>

    <!-- 批量选择工具栏 -->
    <view v-if="selectionMode" class="selection-toolbar">
      <view class="selection-info">已选择 {{ selectedItems.length }} 项</view>
      <view class="selection-actions">
        <view class="selection-btn" @click="cancelSelection">取消</view>
        <view
          class="selection-btn selection-btn-delete"
          :class="{ disabled: isDeleting }"
          @click="batchDelete"
        >
          {{ isDeleting ? "删除中..." : "删除" }}
        </view>
      </view>
    </view>

    <!-- 使用 scroll-view 实现虚拟滚动和分页加载 -->
    <scroll-view
      class="section"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
      :lower-threshold="100"
    >
      <!-- 骨架屏 -->
      <view v-if="loading" class="skeleton">
        <view v-for="i in 9" :key="i" class="skeleton-item"></view>
      </view>

      <view v-else-if="!loading && gridItems.length === 0" class="empty">
        <text class="empty-icon">{{ emptyText.icon }}</text>
        <text class="empty-text">{{ emptyText.text }}</text>
        <text class="empty-hint">{{ emptyText.hint }}</text>
      </view>
      <view v-else class="grid">
        <view
          v-for="item in displayItems"
          :key="item.type === 'folder' ? item.path : item._id"
          class="grid-item"
          :class="{ selected: isSelected(item) }"
          @click="handleGridItemClick(item)"
          @longpress="handleLongPress(item)"
        >
          <!-- 选择模式复选框 -->
          <view v-if="selectionMode && item.type === 'image'" class="checkbox">
            <text v-if="isSelected(item)">✓</text>
          </view>

          <!-- 图片懒加载 + 加载失败处理 -->
          <view class="thumb-wrapper">
            <image
              class="thumb"
              :src="item.thumb"
              mode="aspectFill"
              lazy-load
              @error="handleImageError(item)"
            />
            <view v-if="item.loading" class="image-loading">
              <text>加载中...</text>
            </view>
          </view>
          <view class="item-info">
            <text class="item-name">
              {{ item.type === "folder" ? item.name : "" }}
            </text>
            <text
              v-if="item.type === 'folder' && item.imageCount > 0"
              class="item-count"
            >
              {{ item.imageCount }} 张图片
            </text>
          </view>
          <view v-if="item.type === 'folder'" class="folder-badge">📁</view>
        </view>
      </view>

      <!-- 加载更多提示 -->
      <view v-if="hasMore" class="loading-more">
        <text>{{ loadingMore ? "加载中..." : "上拉加载更多" }}</text>
      </view>
      <view v-else class="no-more">
        <text>没有更多了</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import {
  ROOT_PATH,
  buildBreadcrumbs,
  createFolder,
  deleteFolder,
  deleteImage,
  ensureRootFolder,
  getParentPath,
  listFolderContent,
  uploadImageToCloud,
} from "@/utils/cloud";

// 常量
const FOLDER_THUMB_BASE64 =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgNTAwIDQwMCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmOGY5ZmE7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOGViZWQ7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjxsaW5lYXJHcmFkaWVudCBpZD0iZm9sZGVyIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzVmYjNmZjtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzM0OTVmZjtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PGZpbHRlciBpZD0ic2hhZG93Ij48ZmVHYXVzc2lhbkJsdXIgaW49IlNvdXJjZUFscGhhIiBzdGREZXZpYXRpb249IjgiLz48ZmVPZmZzZXQgZHk9IjQiLz48ZmVDb21wb25lbnRUcmFuc2ZlciBpbj0iU291cmNlQWxwaGEiPjxmZUZ1bmNBIHR5cGU9ImxpbmVhciIgc2xvcGU9IjAuMTUiLz48L2ZlQ29tcG9uZW50VHJhbnNmZXI+PGZlTWVyZ2U+PGZlTWVyZ2VOb2RlLz48ZmVNZXJnZU5vZGUgaW49IlNvdXJjZUdyYXBoaWMiLz48L2ZlTWVyZ2U+PC9maWx0ZXI+PC9kZWZzPjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iNDAwIiBmaWxsPSJ1cmwoI2JnKSIvPjxnIGZpbHRlcj0idXJsKCNzaGFkb3cpIj48cGF0aCBkPSJNMTAwIDEyMGMwLTEwIDgtMTggMTgtMThoMTAwYzYgMCAxMiAzIDE1IDhsMTUgMjJoMTM0YzEwIDAgMTggOCAxOCAxOHYxODBjMCAxMC04IDE4LTE4IDE4SDExOGMtMTAgMC0xOC04LTE4LTE4VjEyMHoiIGZpbGw9InVybCgjZm9sZGVyKSIvPjxwYXRoIGQ9Ik0xMDAgMTIwYzAtMTAgOC0xOCAxOC0xOGgxMDBjNiAwIDEyIDMgMTUgOGwxNSAyMmgxMzRjMTAgMCAxOCA4IDE4IDE4djIwSDEwMFYxMjB6IiBmaWxsPSIjNzRjNGZmIiBvcGFjaXR5PSIwLjYiLz48L2c+PC9zdmc+";

const PLACEHOLDER_BASE64 =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYWFhIiBmb250LXNpemU9IjI0Ij7lm77niYc8L3RleHQ+PC9zdmc+";

// 工具函数
const withLoading = async (title, fn) => {
  try {
    uni.showLoading({ title, mask: true });
    await fn();
    uni.hideLoading();
  } catch (error) {
    uni.hideLoading();
    throw error;
  }
};

const debounce = (fn, delay) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// 响应式数据
const currentPath = ref(ROOT_PATH);
const breadcrumbs = ref([{ name: "root", path: ROOT_PATH }]);
const folderList = ref([]);
const imageList = ref([]);
const loading = ref(false);
const refreshing = ref(false);

// 批量选择相关
const selectionMode = ref(false);
const selectedItems = ref([]);
const isDeleting = ref(false);

// 分页相关
const pageSize = ref(20);
const currentPage = ref(1);
const loadingMore = ref(false);

// 计算属性
const gridItems = computed(() => {
  return [
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
  ];
});

const displayItems = computed(() => {
  const endIndex = currentPage.value * pageSize.value;
  return gridItems.value.slice(0, endIndex);
});

const hasMore = computed(() => {
  return displayItems.value.length < gridItems.value.length;
});

const previewUrls = computed(() => {
  return imageList.value.map((item) => item.previewUrl).filter(Boolean);
});

const emptyText = computed(() => {
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

// 方法
const bootstrap = async () => {
  try {
    loading.value = true;
    await ensureRootFolder();
    await loadCurrentContent();
  } catch (error) {
    uni.showToast({ title: error.message || "初始化失败", icon: "none" });
  } finally {
    loading.value = false;
  }
};

const loadCurrentContent = async () => {
  try {
    // 只有在非刷新状态下才显示 loading
    if (!refreshing.value) {
      loading.value = true;
    }
    const { folders, images } = await listFolderContent(currentPath.value);
    folderList.value = folders;
    imageList.value = images;
    currentPage.value = 1;
    breadcrumbs.value = buildBreadcrumbs(currentPath.value);
  } catch (error) {
    uni.showToast({ title: error.message || "加载失败", icon: "none" });
  } finally {
    loading.value = false;
    refreshing.value = false;
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
  currentPath.value = path;
  await loadCurrentContent();
};

const goBack = async () => {
  if (currentPath.value === ROOT_PATH) {
    return;
  }
  currentPath.value = getParentPath(currentPath.value);
  await loadCurrentContent();
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

  // 验证文件夹名称
  if (!folderName) {
    uni.showToast({ title: "分组名称不能为空", icon: "none" });
    return;
  }

  if (folderName.length > 50) {
    uni.showToast({ title: "分组名称不能超过50个字符", icon: "none" });
    return;
  }

  // 检查非法字符
  const invalidChars = /[\/\\:*?"<>|]/;
  if (invalidChars.test(folderName)) {
    uni.showToast({
      title: '分组名称不能包含特殊字符 / \\ : * ? " < > |',
      icon: "none",
    });
    return;
  }

  try {
    await createFolder(currentPath.value, folderName);
    uni.showToast({ title: "创建成功", icon: "success" });
    await loadCurrentContent();
  } catch (error) {
    uni.showToast({ title: error.message || "创建失败", icon: "none" });
  }
};

const handleUpload = async () => {
  try {
    const pickRes = await uni.chooseImage({
      count: 9,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
    });
    const files = pickRes.tempFilePaths || [];
    if (!files.length) {
      return;
    }

    let completed = 0;
    uni.showLoading({ title: `上传中 0/${files.length}`, mask: true });

    // 使用 Promise.allSettled 支持部分上传失败
    const results = await Promise.allSettled(
      files.map((filePath) => {
        const originalName = filePath.split("/").pop() || "";
        return uploadImageToCloud(
          filePath,
          currentPath.value,
          originalName,
        ).finally(() => {
          completed++;
          uni.showLoading({
            title: `上传中 ${completed}/${files.length}`,
            mask: true,
          });
        });
      }),
    );

    uni.hideLoading();

    // 统计上传结果
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

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
    uni.showToast({ title: error.message || "上传失败", icon: "none" });
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
  loadingMore.value = true;
  setTimeout(() => {
    currentPage.value++;
    loadingMore.value = false;
  }, 300);
};

const loadMore = debounce(loadMoreInternal, 200);

const handleImageError = (item) => {
  if (item.type === "image") {
    const image = imageList.value.find((img) => img._id === item._id);
    if (image) {
      image.previewUrl = PLACEHOLDER_BASE64;
    }
  }
};

const handleLongPress = async (item) => {
  uni.vibrateShort({ type: "medium" });

  if (item.type === "image") {
    if (selectionMode.value) {
      return;
    }

    try {
      const res = await uni.showActionSheet({
        itemList: ["删除图片", "进入选择模式"],
      });

      if (res.tapIndex === 0) {
        await handleDeleteImage(item);
      } else if (res.tapIndex === 1) {
        enterSelectionMode(item);
      }
    } catch (error) {
      // 用户取消操作，不需要处理
    }
  } else if (item.type === "folder") {
    if (item.path === ROOT_PATH) {
      uni.showToast({ title: "根目录不能删除", icon: "none" });
      return;
    }
    const modal = await uni.showModal({
      title: "确认删除",
      content: `确定要删除分组"${item.name}"吗？只能删除空分组。`,
    });
    if (modal.confirm) {
      await handleDeleteFolder(item);
    }
  }
};

const enterSelectionMode = (item) => {
  selectionMode.value = true;
  selectedItems.value = [item];
};

const isSelected = (item) => {
  return selectedItems.value.some((i) => i._id === item._id);
};

const toggleSelection = (item) => {
  const index = selectedItems.value.findIndex((i) => i._id === item._id);
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
      selectedItems.value.map((item) =>
        deleteImage(item._id, item.cloudFileId),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
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
    uni.showToast({ title: error.message || "删除失败", icon: "none" });
  } finally {
    isDeleting.value = false;
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
    uni.showToast({ title: error.message || "删除失败", icon: "none" });
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
    uni.showToast({ title: error.message || "删除失败", icon: "none" });
  }
};

// 生命周期
onMounted(() => {
  bootstrap();
});
</script>

<style>
.page {
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f6f7fb;
  padding-bottom: env(safe-area-inset-bottom);
}

.header {
  flex-shrink: 0;
  background: #ffffff;
  padding: 24rpx 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.toolbar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 14rpx 20rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
  transition: all 0.2s;
  cursor: pointer;
}

.btn-icon {
  font-size: 32rpx;
  line-height: 1;
}

.btn-text {
  font-size: 26rpx;
}

.btn-back {
  background: #f5f7fa;
  color: #606266;
}

.btn-back.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.btn-back:active {
  background: #e8eaed;
}

.btn-create {
  background: #ecf5ff;
  color: #409eff;
}

.btn-create:active {
  background: #d9ecff;
}

.btn-upload {
  flex: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  font-weight: 500;
}

.btn-upload:active {
  opacity: 0.9;
}

.btn-refresh {
  background: #f5f7fa;
  color: #909399;
  padding: 14rpx 16rpx;
}

.btn-refresh:active {
  background: #e8eaed;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  background: #f8f9fa;
  border-radius: 8rpx;
  overflow-x: auto;
}

.breadcrumb-icon {
  font-size: 32rpx;
  flex-shrink: 0;
}

.breadcrumb-path {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
  flex: 1;
  overflow-x: auto;
}

.crumb {
  font-size: 26rpx;
  color: #606266;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s;
}

.crumb:active {
  color: #409eff;
}

.crumb.active {
  color: #303133;
  font-weight: 500;
}

.separator {
  margin: 0 8rpx;
  color: #c0c4cc;
  font-size: 28rpx;
}

.section {
  flex: 1;
  background: #ffffff;
  border-radius: 12rpx;
  padding: 16rpx;
  padding-bottom: calc(16rpx + var(--selection-toolbar-height, 0rpx));
  margin: 20rpx 0;
  overflow: hidden;
  box-sizing: border-box;
}

.skeleton {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
}

.skeleton-item {
  height: 240rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
  border-radius: 12rpx;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
  opacity: 0.5;
}

.empty-text {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 24rpx;
  color: #999;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
}

.grid-item {
  position: relative;
  overflow: hidden;
  border-radius: 12rpx;
  background: #fafafa;
  box-shadow: 0 10rpx 20rpx rgba(0, 0, 0, 0.04);
  transition: transform 0.2s;
}

.grid-item.selected {
  transform: scale(0.95);
  box-shadow: 0 0 0 4rpx #409eff;
}

.checkbox {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #409eff;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  z-index: 10;
  box-shadow: 0 4rpx 8rpx rgba(64, 158, 255, 0.3);
}

.thumb-wrapper {
  position: relative;
  width: 100%;
  height: 190rpx;
  background: #ececec;
}

.thumb {
  width: 100%;
  height: 100%;
}

.image-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.1);
  font-size: 22rpx;
  color: #666;
}

.loading-more,
.no-more {
  text-align: center;
  padding: 30rpx 0;
  font-size: 24rpx;
  color: #999;
}

.item-info {
  padding: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.item-name {
  font-size: 24rpx;
  color: #222;
  line-height: 32rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-count {
  font-size: 20rpx;
  color: #999;
}

.item-meta {
  font-size: 20rpx;
  color: #888;
}

.folder-badge {
  position: absolute;
  top: 14rpx;
  right: 14rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
}

.selection-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  padding: 24rpx 20rpx;
  box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
}

.selection-info {
  font-size: 28rpx;
  color: #303133;
}

.selection-actions {
  display: flex;
  gap: 16rpx;
}

.selection-btn {
  padding: 12rpx 32rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
  background: #f5f7fa;
  color: #606266;
}

.selection-btn-delete {
  background: #f56c6c;
  color: #ffffff;
}

.selection-btn-delete.disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
