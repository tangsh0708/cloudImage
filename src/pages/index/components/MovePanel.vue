<template>
  <view class="modal-mask" @click="$emit('close')">
    <view class="move-panel" @click.stop>
      <view class="move-panel-header">
        <view>
          <text class="move-title">移动到分组</text>
          <text class="move-desc">共 {{ pendingCount }} 张图片</text>
        </view>
        <text class="move-close" @click="$emit('close')">×</text>
      </view>

      <scroll-view class="folder-options" scroll-y>
        <view
          v-for="folder in folderOptions"
          :key="folder.path"
          class="folder-option"
          :class="{
            active: targetPath === folder.path,
            disabled: folder.path === currentPath,
          }"
          @click="handleSelect(folder)"
        >
          <text class="folder-option-name">{{ folder.breadcrumbName }}</text>
          <text v-if="folder.path === currentPath" class="folder-option-note">
            当前分组
          </text>
        </view>
      </scroll-view>

      <view class="move-actions">
        <view class="move-btn" @click="$emit('close')">取消</view>
        <view
          class="move-btn move-btn-primary"
          :class="{ disabled: !targetPath || isMoving }"
          @click="$emit('confirm')"
        >
          {{ isMoving ? "移动中..." : "确认移动" }}
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  currentPath: {
    type: String,
    required: true,
  },
  folderOptions: {
    type: Array,
    default: () => [],
  },
  isMoving: {
    type: Boolean,
    default: false,
  },
  pendingCount: {
    type: Number,
    default: 0,
  },
  targetPath: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close", "confirm", "select"]);

const handleSelect = (folder) => {
  if (!folder || folder.path === props.currentPath) {
    return;
  }

  emit("select", folder);
};
</script>

<style>
.modal-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(18, 28, 43, 0.48);
  z-index: 200;
}

.move-panel {
  width: 100%;
  max-height: 78vh;
  padding: 28rpx 24rpx calc(28rpx + env(safe-area-inset-bottom));
  border-radius: 28rpx 28rpx 0 0;
  background: #ffffff;
  box-sizing: border-box;
}

.move-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.move-title {
  display: block;
  margin-bottom: 8rpx;
  font-size: 34rpx;
  font-weight: 600;
  color: #1f2d3d;
}

.move-desc {
  display: block;
  font-size: 24rpx;
  color: #8b96a8;
}

.move-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 28rpx;
  background: #f2f4f7;
  color: #7a869a;
  font-size: 34rpx;
  line-height: 52rpx;
  text-align: center;
}

.folder-options {
  max-height: 52vh;
}

.folder-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  min-height: 76rpx;
  padding: 0 18rpx;
  margin-bottom: 10rpx;
  border: 2rpx solid transparent;
  border-radius: 16rpx;
  background: #f7f9fc;
  box-sizing: border-box;
}

.folder-option.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.folder-option.disabled {
  opacity: 0.55;
}

.folder-option-name {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: #2f3a4a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-option-note {
  font-size: 22rpx;
  color: #9aa4b2;
}

.move-actions {
  display: flex;
  gap: 18rpx;
  margin-top: 22rpx;
}

.move-btn {
  flex: 1;
  height: 78rpx;
  border-radius: 18rpx;
  background: #f2f4f7;
  color: #606266;
  font-size: 28rpx;
  line-height: 78rpx;
  text-align: center;
}

.move-btn-primary {
  background: linear-gradient(135deg, #3495ff 0%, #5fb3ff 100%);
  color: #ffffff;
  font-weight: 600;
}

.move-btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
