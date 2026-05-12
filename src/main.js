import { createSSRApp } from "vue";
import App from "./App.vue";
import manifest from "./manifest.json";

const CLOUD_ENV_ID = manifest["mp-weixin"]?.cloudEnv || "云开发id";

function initWechatCloud() {
  // #ifdef MP-WEIXIN
  if (typeof wx !== "undefined" && wx.cloud) {
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true,
    });
  }
  // #endif
}

export function createApp() {
  initWechatCloud();
  const app = createSSRApp(App);
  return {
    app,
  };
}
