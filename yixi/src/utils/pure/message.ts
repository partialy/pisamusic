/**
 * 原生 Message 消息提示组件 (无 Tailwind 依赖)
 */
export type MessageType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface MessageOptions {
  /** 持续时间 (毫秒)，默认 3000。设为 0 时不自动关闭 */
  duration?: number;
  /** 自定义图标颜色 */
  color?: string;
  /** 是否显示关闭按钮 */
  closable?: boolean;
}

const messageCss = `
.native-msg-wrapper {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  pointer-events: none;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.native-msg-item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(226, 232, 240, 0.5);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-radius: 1rem;
  min-width: 300px;
  max-width: 90vw;
  transition: all 0.5s cubic-bezier(0, 0, 0.2, 1);
  opacity: 0;
  transform: translateY(-1.25rem) scale(0.95);
  box-sizing: border-box;
}

:root.dark .native-msg-item, .dark .native-msg-item {
  background-color: rgba(15, 23, 42, 0.8);
  border-color: rgba(51, 65, 85, 0.5);
}

.native-msg-item.native-msg-show {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.native-msg-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.native-msg-icon svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.native-msg-success { color: #10b981; }
.native-msg-error { color: #f43f5e; }
.native-msg-info { color: #3b82f6; }
.native-msg-warning { color: #f59e0b; }
.native-msg-loading { color: #94a3b8; animation: native-msg-spin 1s linear infinite; }

@keyframes native-msg-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.native-msg-text {
  flex-grow: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
  line-height: 1.625;
  margin: 0;
}

:root.dark .native-msg-text, .dark .native-msg-text {
  color: #e2e8f0;
}

.native-msg-close {
  padding: 0.25rem;
  border-radius: 9999px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}
.native-msg-close svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.native-msg-close:hover {
  background-color: #f1f5f9;
  color: #475569;
}
:root.dark .native-msg-close:hover, .dark .native-msg-close:hover {
  background-color: #1e293b;
  color: #e2e8f0;
}
`;

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('native-message-styles')) {
    const style = document.createElement('style');
    style.id = 'native-message-styles';
    style.textContent = messageCss;
    document.head.appendChild(style);
  }
}

export class MessageManager {
  private container: HTMLDivElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      injectStyles();
      this.initContainer();
    }
  }

  private initContainer() {
    if (document.getElementById('native-message-container')) {
      this.container = document.getElementById('native-message-container') as HTMLDivElement;
      return;
    }
    this.container = document.createElement('div');
    this.container.id = 'native-message-container';
    this.container.className = 'native-msg-wrapper';
    document.body.appendChild(this.container);
  }

  private createIcon(type: MessageType, customColor?: string) {
    const iconWrapper = document.createElement('span');
    iconWrapper.className = 'native-msg-icon native-msg-' + type;
    if (customColor) {
      iconWrapper.style.color = customColor;
    }
    
    const paths = {
      success: 'm9 12 2 2 4-4',
      error: 'm15 9-6 6m0-6 6 6',
      warning: 'M12 8v4m0 4h.01',
      info: 'M12 16V12m0-4h.01',
      loading: 'M21 12a9 9 0 1 1-6.219-8.56'
    };

    iconWrapper.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        ${type !== 'loading' ? '<circle cx="12" cy="12" r="10"/>' : ''}
        <path d="${paths[type]}"/>
      </svg>
    `;
    
    return iconWrapper;
  }

  /**
   * 显示消息
   */
  show(content: string, type: MessageType = 'info', options: MessageOptions = {}) {
    if (!this.container) this.initContainer();

    const { duration = 3000, color, closable = false } = options;

    const messageEl = document.createElement('div');
    messageEl.className = 'native-msg-item';

    const iconPart = this.createIcon(type, color);
    const textPart = document.createElement('span');
    textPart.className = 'native-msg-text';
    textPart.textContent = content;

    messageEl.appendChild(iconPart);
    messageEl.appendChild(textPart);

    if (closable) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'native-msg-close';
      closeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      `;
      closeBtn.onclick = () => this.remove(messageEl);
      messageEl.appendChild(closeBtn);
    }

    this.container!.appendChild(messageEl);
    
    // 触发入场动画
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messageEl.classList.add('native-msg-show');
      });
    });

    if (duration > 0) {
      setTimeout(() => this.remove(messageEl), duration);
    }

    return {
      el: messageEl,
      close: () => this.remove(messageEl)
    };
  }

  private remove(el: HTMLElement) {
    el.classList.remove('native-msg-show');
    setTimeout(() => {
      if (el.parentNode === this.container) {
        this.container!.removeChild(el);
      }
    }, 500);
  }

  success(content: string, options?: MessageOptions) {
    return this.show(content, 'success', options);
  }

  error(content: string, options?: MessageOptions) {
    return this.show(content, 'error', options);
  }

  info(content: string, options?: MessageOptions) {
    return this.show(content, 'info', options);
  }

  warning(content: string, options?: MessageOptions) {
    return this.show(content, 'warning', options);
  }

  loading(content: string, options?: MessageOptions) {
    return this.show(content, 'loading', { duration: 0, ...options });
  }
}

export const message = new MessageManager();
