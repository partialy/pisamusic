import { h, render, type VNode } from "vue";

// 全屏蒙层样式
const overlayStyle = {
  display: "flex",
  width: "100vw",
  height: "100vh",
  "align-items": "center",
  "justify-content": "center",
  "background-color": "rgba(0, 0, 0, 0.1)",
  position: "fixed",
  top: 0,
  left: 0,
  "z-index": 1000,
  "backdrop-filter": "blur(10px)",
};

// 内容容器样式
const contentStyle = {
  backgroundColor: "white",
  padding: "20px",
  borderRadius: "8px",
};

export function createDialog(node?: VNode) {
  // 创建挂载点
  const container = document.createElement("div");

  // 关闭函数
  const close = () => {
    render(null, container);
    container.remove();
  };

  // 渲染对话框
  const dialogVNode = h(
    "div",
    {
      style: overlayStyle,
      onClick: (e: MouseEvent) => {
        if (e.target === e.currentTarget) close(); // 点击蒙层关闭
      },
    },
    [
      h("div", { style: contentStyle }, [
        node ||
          h("div", {
            style: {
              width: "400px",
              height: "300px",
            },
          }), // 默认内容或传入的 VNode
        h("button", { onClick: close, style: { marginTop: "10px" } }, "关闭"),
      ]),
    ]
  );

  // 挂载到 body
  render(dialogVNode, container);
  document.body.appendChild(container);

  return close; // 返回关闭函数以便外部控制
}
