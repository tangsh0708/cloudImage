const withLoading = async (title, fn) => {
  try {
    uni.showLoading({ title, mask: true });
    const result = await fn();
    uni.hideLoading();
    return result;
  } catch (error) {
    uni.hideLoading();
    throw error;
  }
};

const debounce = (fn, delay) => {
  let timer = null;

  return function (...args) {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) {
    return "未知";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getLocalFileName = (filePath) => {
  return String(filePath || "")
    .split(/[\\/]/)
    .pop();
};

const showError = (error, fallback) => {
  uni.showToast({ title: error.message || fallback, icon: "none" });
};

export {
  debounce,
  formatFileSize,
  getLocalFileName,
  showError,
  withLoading,
};
