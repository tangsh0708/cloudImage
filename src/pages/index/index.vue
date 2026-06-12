<template>
  <view class="page">
    <gallery-header
      :breadcrumbs="breadcrumbs"
      :content-summary="contentSummary"
      :current-path="currentPath"
      :root-path="ROOT_PATH"
      :search-keyword="searchKeyword"
      :sort-index="sortIndex"
      :sort-options="sortOptions"
      @create-folder="handleCreateFolder"
      @enter-folder="enterFolder"
      @go-back="goBack"
      @rebuild-counts="handleRebuildCounts"
      @refresh="loadCurrentContent"
      @search-change="searchKeyword = $event"
      @sort-change="handleSortChange"
      @upload="handleUpload"
    />

    <selection-toolbar
      v-if="selectionMode"
      :is-deleting="isDeleting"
      :is-moving="isMoving"
      :selected-count="selectedItems.length"
      @cancel="cancelSelection"
      @delete="batchDelete"
      @move="openMovePanel(selectedItems)"
    />

    <move-panel
      v-if="movePanelVisible"
      :current-path="currentPath"
      :folder-options="folderOptions"
      :is-moving="isMoving"
      :pending-count="pendingMoveItems.length"
      :target-path="moveTargetPath"
      @close="closeMovePanel"
      @confirm="confirmMove"
      @select="selectMoveTarget"
    />

    <gallery-grid
      :empty-text="emptyText"
      :has-more="hasMore"
      :items="gridItems"
      :loading="loading"
      :loading-more="loadingMore"
      :refreshing="refreshing"
      :selected-ids="selectedIds"
      :selection-mode="selectionMode"
      :show-no-more="showNoMore"
      @image-error="handleImageError"
      @item-click="handleGridItemClick"
      @item-longpress="handleLongPress"
      @load-more="loadMore"
      @refresh="onRefresh"
    />
  </view>
</template>

<script setup>
import GalleryGrid from "./components/GalleryGrid.vue";
import GalleryHeader from "./components/GalleryHeader.vue";
import MovePanel from "./components/MovePanel.vue";
import SelectionToolbar from "./components/SelectionToolbar.vue";
import { useGalleryPage } from "./useGalleryPage";

const {
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
} = useGalleryPage();
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
</style>
