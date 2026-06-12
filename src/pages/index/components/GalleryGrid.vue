<template>
  <scroll-view
    class="section"
    scroll-y
    refresher-enabled
    :refresher-triggered="refreshing"
    :lower-threshold="100"
    @refresherrefresh="$emit('refresh')"
    @scrolltolower="$emit('load-more')"
  >
    <view v-if="loading" class="skeleton">
      <view v-for="i in 9" :key="i" class="skeleton-item"></view>
    </view>

    <view v-else-if="items.length === 0" class="empty">
      <text class="empty-icon">{{ emptyText.icon }}</text>
      <text class="empty-text">{{ emptyText.text }}</text>
      <text class="empty-hint">{{ emptyText.hint }}</text>
    </view>

    <view v-else class="grid">
      <view
        v-for="item in items"
        :key="getItemKey(item)"
        class="grid-item"
        :class="{ selected: isSelected(item) }"
        @click="$emit('item-click', item)"
        @longpress="$emit('item-longpress', item)"
      >
        <view v-if="selectionMode && item.type === 'image'" class="checkbox">
          <text v-if="isSelected(item)">✓</text>
        </view>

        <view class="thumb-wrapper">
          <image
            class="thumb"
            :src="item.thumb"
            mode="aspectFill"
            lazy-load
            @error="$emit('image-error', item)"
          />
          <view v-if="item.loading" class="image-loading">
            <text>加载中...</text>
          </view>
        </view>

        <view class="item-info">
          <text class="item-name">{{ item.name }}</text>
          <text v-if="item.type === 'folder'" class="item-count">
            {{ item.imageCount > 0 ? `${item.imageCount} 张图片` : "空分组" }}
          </text>
          <text v-else class="item-meta">{{ formatFileSize(item.size) }}</text>
        </view>

        <view v-if="item.type === 'folder'" class="folder-badge">📁</view>
      </view>
    </view>

    <view v-if="hasMore" class="loading-more">
      <text>{{ loadingMore ? "加载中..." : "上拉加载更多" }}</text>
    </view>
    <view v-else-if="showNoMore" class="no-more">
      <text>没有更多了</text>
    </view>
  </scroll-view>
</template>

<script setup>
import { formatFileSize } from "../helpers";

const props = defineProps({
  emptyText: {
    type: Object,
    default: () => ({
      icon: "📂",
      text: "暂无内容",
      hint: "",
    }),
  },
  hasMore: {
    type: Boolean,
    default: false,
  },
  items: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  loadingMore: {
    type: Boolean,
    default: false,
  },
  refreshing: {
    type: Boolean,
    default: false,
  },
  selectedIds: {
    type: Array,
    default: () => [],
  },
  selectionMode: {
    type: Boolean,
    default: false,
  },
  showNoMore: {
    type: Boolean,
    default: false,
  },
});

defineEmits([
  "image-error",
  "item-click",
  "item-longpress",
  "load-more",
  "refresh",
]);

const getItemKey = (item) => {
  return item.type === "folder" ? item.path : item._id;
};

const isSelected = (item) => {
  return item.type === "image" && props.selectedIds.includes(item._id);
};
</script>

<style>
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
</style>
