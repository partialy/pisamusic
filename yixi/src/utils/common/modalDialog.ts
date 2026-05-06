// 定义样式，包含了默认弹窗的结构和美观的样式
const style = `
  /* 遮罩层样式 */
  .custom-dialog-wrapper {
    width: 100vw;
    height: 100vh;
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 1100;
    position: fixed;
    top: 0;
    left: 0;
    background: rgba(48, 48, 48, 0.2); /* 更常见的遮罩颜色 */
    backdrop-filter: blur(30px); /* 可选：添加模糊效果 */
  }

  /* 弹窗卡片样式 */
  .custom-dialog-card {
    width: 400px;
    /* height: auto; 让卡片高度自适应内容 */
    background-color: white;
    border-radius: 8px; /* 圆角 */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* 阴影 */
    overflow: hidden; /* 防止圆角切割内容 */
    display: flex;
    flex-direction: column;
  }

  /* 头部样式 */
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px; /* 内边距 */
    border-bottom: 1px solid #eee; /* 底部分割线 */
  }

  .dialog-title {
    font-size: 18px;
    font-weight: bold;
    color: #333;
    margin: 0; /* 重置默认外边距 */
  }

  .dialog-close-button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #999;
    padding: 0; /* 重置默认内边距 */
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%; /* 圆形按钮 */
    transition: background-color 0.2s; /* 悬停过渡 */
  }

  .dialog-close-button:hover {
    background-color: #f0f0f0; /* 悬停背景色 */
    color: #333; /* 悬停文字颜色 */
  }

  /* 内容区域样式 */
  .dialog-body {
    padding: 20px; /* 内边距 */
    flex-grow: 1; /* 占据剩余空间 */
    overflow-y: auto; /* 如果内容过多，可以滚动 */
  }

  .dialog-text {
    color: #666;
    line-height: 1.5; /* 行高 */
  }

  /* 底部按钮区域样式 */
  .dialog-footer {
    display: flex;
    justify-content: flex-end; /* 按钮靠右 */
    gap: 10px; /* 按钮间距 */
    padding: 16px 20px; /* 内边距 */
    border-top: 1px solid #eee; /* 顶部分割线 */
  }

  .dialog-button {
    padding: 8px 16px; /* 按钮内边距 */
    border: 1px solid #ddd; /* 边框 */
    border-radius: 4px; /* 按钮圆角 */
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s; /* 悬停过渡 */
  }

  .dialog-button.cancel {
    background-color: #fff;
    color: #666;
  }

  .dialog-button.cancel:hover {
    background-color: #f5f5f5;
  }

  .dialog-button.confirm {
    background-color: #007bff; /* 主色调 */
    color: white;
    border-color: #007bff; /* 主色调边框 */
  }

  .dialog-button.confirm:hover {
    background-color: #0056b3; /* 深一点的主色调 */
    border-color: #0056b3;
  }
`;

// 全局变量用于存储当前打开的对话框元素，方便关闭
let currentDialogWrapper: HTMLElement | null = null;

/**
 * 关闭当前打开的对话框
 */
export function closeCustomDialog() {
  if (currentDialogWrapper && currentDialogWrapper.parentNode) {
    currentDialogWrapper.parentNode.removeChild(currentDialogWrapper);
    currentDialogWrapper = null;
  }
  const existingStyle = document.querySelector('style[data-dialog-style="true"]');
  if (existingStyle) {
    existingStyle.remove();
  }
}

/**
 * 打开一个自定义对话框
 * @param {Object} options - 配置选项
 * @param {string} [options.title='提示'] - 对话框标题
 * @param {string} [options.text] - 对话框中间显示的文本内容
 * @param {string} [options.cancelText='取消'] - 取消按钮文字
 * @param {string} [options.confirmText='确定'] - 确认按钮文字
 * @param {string | HTMLElement} [options.content] - 自定义内容 (如果提供，将覆盖 title, text, buttons)
 * @param {Function} [options.onConfirm] - 点击确认按钮时的回调
 * @param {Function} [options.onCancel] - 点击取消按钮时的回调
 * @returns {Object} - 包含 close 方法的对象
 */
export function openCustomDialog(
  options: {
    title?: string;
    text?: string;
    cancelText?: string;
    confirmText?: string;
    content?: string | HTMLElement;
    onConfirm?: Function;
    onCancel?: Function;
  } = {}
): { close: () => void } {
  const {
    title = "提示",
    text = "确定操作吗?",
    cancelText = "取消",
    confirmText = "确定",
    content,
    onConfirm,
    onCancel,
  } = options;

  // 检查样式是否已存在，避免重复添加
  if (!document.querySelector('style[data-dialog-style="true"]')) {
    let s = document.createElement("style");
    s.textContent = style;
    s.setAttribute("data-dialog-style", "true"); // 添加标识，方便后续查找或移除
    document.head.appendChild(s);
  }

  // 关闭之前打开的对话框（如果存在）
  if (currentDialogWrapper) {
    closeCustomDialog();
  }

  const wrapper = document.createElement("div");
  wrapper.className = "custom-dialog-wrapper";
  wrapper.style.display = "flex"; // 显示对话框
  currentDialogWrapper = wrapper; // 存储引用

  // 点击遮罩层关闭对话框
  wrapper.addEventListener("click", (e) => {
    if (e.target === wrapper) {
      closeCustomDialog();
      if (typeof onCancel === "function") {
        onCancel();
      }
    }
  });

  const dialogCard = document.createElement("div");
  dialogCard.className = "custom-dialog-card";

  // 如果提供了自定义 content，则直接使用它
  if (content) {
    if (typeof content === "string") {
      dialogCard.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      dialogCard.appendChild(content);
    }
  } else {
    // 否则，使用默认的弹窗结构
    const defaultTemplate = `
      <div class="dialog-header">
        <div class="dialog-title">${title}</div>
        <button class="dialog-close-button">&times;</button>
      </div>
      <div class="dialog-body">
        <div class="dialog-text">${text}</div>
      </div>
      <div class="dialog-footer">
        <button class="dialog-button cancel">${cancelText}</button>
        <button class="dialog-button confirm">${confirmText}</button>
      </div>
    `;
    dialogCard.innerHTML = defaultTemplate;

    // 获取按钮和关闭按钮元素，以便添加事件监听器
    const cancelButton = dialogCard.querySelector(".dialog-button.cancel");
    const confirmButton = dialogCard.querySelector(".dialog-button.confirm");
    const closeButton = dialogCard.querySelector(".dialog-close-button");

    // 为按钮添加点击事件
    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        closeCustomDialog();
        if (typeof onCancel === "function") {
          onCancel();
        }
      });
    }
    if (confirmButton) {
      confirmButton.addEventListener("click", () => {
        closeCustomDialog();
        if (typeof onConfirm === "function") {
          onConfirm();
        }
      });
    }
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        closeCustomDialog();
        if (typeof onCancel === "function") {
          onCancel();
        }
      });
    }
  }

  wrapper.appendChild(dialogCard);
  document.body.appendChild(wrapper);

  return {
    close: closeCustomDialog,
  };
}

// --- 使用示例 ---
// openCustomDialog({
//   title: '删除确认',
//   text: '您确定要删除这个项目吗？此操作无法撤销。',
//   confirmText: '删除',
//   cancelText: '再想想',
//   onConfirm: () => {
//     console.log('用户点击了确定');
//   },
//   onCancel: () => {
//     console.log('用户点击了取消或关闭');
//   }
// });

// // 或者打开一个完全自定义内容的对话框
// const customContent = document.createElement('div');
// customContent.innerHTML = '<p>这是一个自定义内容</p><button>按钮</button>';
// openCustomDialog({ content: customContent });
