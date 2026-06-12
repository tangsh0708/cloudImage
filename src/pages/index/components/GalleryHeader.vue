<template>
  <view class="header">
    <view class="toolbar">
      <view
        class="btn btn-back"
        :class="{ disabled: currentPath === rootPath }"
        @click="$emit('go-back')"
      >
        <text class="btn-icon">←</text>
        <text class="btn-text">返回</text>
      </view>
      <view class="btn btn-create" @click="$emit('create-folder')">
        <text class="btn-icon">+</text>
        <text class="btn-text">新建</text>
      </view>
      <view class="btn btn-upload" @click="$emit('upload')">
        <text class="btn-icon">↑</text>
        <text class="btn-text">上传</text>
      </view>
      <view
        class="btn btn-refresh"
        @click="$emit('refresh')"
        @longpress="$emit('rebuild-counts')"
      >
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
          @click="$emit('enter-folder', item.path)"
        >
          {{ item.name }}
          <text v-if="idx < breadcrumbs.length - 1" class="separator">›</text>
        </text>
      </view>
    </view>

    <view class="filter-bar">
      <view class="search-box">
        <text class="search-icon">⌕</text>
        <input
          :value="searchKeyword"
          class="search-input"
          confirm-type="search"
          placeholder="搜索当前分组"
          @input="handleSearchInput"
        />
        <text
          v-if="searchKeyword"
          class="search-clear"
          @click="$emit('search-change', '')"
        >
          ×
        </text>
      </view>
      <picker
        mode="selector"
        :range="sortOptions"
        range-key="label"
        :value="sortIndex"
        @change="handleSortChange"
      >
        <view class="sort-picker">{{ sortOptions[sortIndex].label }}</view>
      </picker>
    </view>

    <view class="content-summary">
      <text>{{ contentSummary }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  breadcrumbs: {
    type: Array,
    default: () => [],
  },
  contentSummary: {
    type: String,
    default: "",
  },
  currentPath: {
    type: String,
    required: true,
  },
  rootPath: {
    type: String,
    required: true,
  },
  searchKeyword: {
    type: String,
    default: "",
  },
  sortIndex: {
    type: Number,
    default: 0,
  },
  sortOptions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "create-folder",
  "enter-folder",
  "go-back",
  "rebuild-counts",
  "refresh",
  "search-change",
  "sort-change",
  "upload",
]);

const handleSearchInput = (event) => {
  emit("search-change", event.detail.value || "");
};

const handleSortChange = (event) => {
  emit("sort-change", Number(event.detail.value || 0));
};
</script>

<style>
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 18rpx;
}

.search-box {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
  height: 68rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: #f3f6fb;
  box-sizing: border-box;
}

.search-icon {
  font-size: 30rpx;
  color: #9aa4b2;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 68rpx;
  font-size: 26rpx;
  color: #303133;
}

.search-clear {
  width: 36rpx;
  height: 36rpx;
  border-radius: 18rpx;
  background: #d9e2ef;
  color: #637083;
  font-size: 28rpx;
  line-height: 34rpx;
  text-align: center;
}

.sort-picker {
  min-width: 150rpx;
  height: 68rpx;
  padding: 0 20rpx;
  border-radius: 18rpx;
  background: #eef5ff;
  color: #2f6fda;
  font-size: 24rpx;
  line-height: 68rpx;
  text-align: center;
  box-sizing: border-box;
}

.content-summary {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #8b96a8;
}
</style>
