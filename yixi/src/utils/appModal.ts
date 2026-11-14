import { h, type Component } from "vue";
import { NIcon } from "naive-ui";

// 声明式与动态弹窗共用 Naive 生命周期、焦点和 card 壳层。
export const appModalProps = {
  preset: "card" as const,
  class: "app-modal-card",
  transformOrigin: "center" as const,
  autoFocus: true,
  trapFocus: true,
  maskClosable: true,
  closeOnEsc: true,
  bordered: false,
  role: "dialog",
  "aria-modal": true,
};

export function renderModalTitle(title: string, icon?: Component) {
  return h("div", { class: "app-modal-title" }, [
    icon ? h(NIcon, { component: icon, size: 20 }) : null,
    h("span", title),
  ]);
}
