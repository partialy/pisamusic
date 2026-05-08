import { createApp } from "vue";
import "./base.css";
import "./anim.scss"
import App from "./App.vue";
import { createPinia } from "pinia";
import router from "./router";
import electronAPI from "./utils/electron";

const pinia = createPinia();
const app = createApp(App);

// Vue 全局错误处理器
app.config.errorHandler = (err: any, _vm, info) => {
  console.error("Vue 全局错误:", err, info);
  window.$notification.error({
    title: "出现错误：" + err.message,
    content: err,
    description: info,
    duration: 5000,
  });
  // 可以在这里发送错误到主进程或错误收集服务
  if (window.electronAPI) {
    console.log("发送错误到主进程或错误收集服务");
    void electronAPI.reportError(err, {
      scope: "vue",
      info,
      status: err?.status,
    });
  }
};

app.use(router);
app.use(pinia);

app.mount("#app");
