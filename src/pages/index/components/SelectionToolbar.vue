<template>
  <view class="selection-toolbar">
    <view class="selection-info">已选择 {{ selectedCount }} 项</view>
    <view class="selection-actions">
      <view class="selection-btn" @click="$emit('cancel')">取消</view>
      <view
        class="selection-btn"
        :class="{ disabled: isMoving }"
        @click="$emit('move')"
      >
        {{ isMoving ? "移动中..." : "移动" }}
      </view>
      <view
        class="selection-btn selection-btn-delete"
        :class="{ disabled: isDeleting }"
        @click="$emit('delete')"
      >
        {{ isDeleting ? "删除中..." : "删除" }}
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  isDeleting: {
    type: Boolean,
    default: false,
  },
  isMoving: {
    type: Boolean,
    default: false,
  },
  selectedCount: {
    type: Number,
    default: 0,
  },
});

defineEmits(["cancel", "delete", "move"]);
</script>

<style>
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

.selection-btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.selection-btn-delete {
  background: #f56c6c;
  color: #ffffff;
}
</style>
