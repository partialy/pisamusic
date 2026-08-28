/**
 * PisaMusic 原生拟真视窗引擎 (纯 JavaScript 实现，无 React / Vue 等框架依赖)
 */
(function (global) {
  let zCounter = 1000;
  const activeWindows = [];

  class Win {
    constructor(options = {}) {
      const defaultWidth = 720;
      const defaultHeight = 480;
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768;
      const defaultX = Math.max(16, (viewportWidth - defaultWidth) / 2 + (activeWindows.length * 20) % 100);
      const defaultY = Math.max(16, (viewportHeight - defaultHeight) / 2 + (activeWindows.length * 20) % 100);

      this.options = {
        title: options.title || "视窗",
        width: options.width || defaultWidth,
        height: options.height || defaultHeight,
        x: options.x !== undefined ? options.x : defaultX,
        y: options.y !== undefined ? options.y : defaultY,
        minWidth: options.minWidth || 320,
        minHeight: options.minHeight || 240,
        theme: options.theme || "win",
        content: options.content || "",
        onClose: options.onClose || (() => {}),
        onMaximize: options.onMaximize || (() => {}),
      };

      this.x = this.options.x;
      this.y = this.options.y;
      this.width = this.options.width;
      this.height = this.options.height;
      this.isMaximized = false;
      this.isMinimized = false;
      this.preMaximizedRect = null;

      this.createDom();
      this.setupEvents();
      activeWindows.push(this);
    }

    createDom() {
      this.container = document.createElement("div");
      this.container.className = "win-native-container win-rounded";
      this.container.style.opacity = "0";
      this.container.style.transform = "scale(0.95) translateY(10px)";
      this.container.style.left = `${this.x}px`;
      this.container.style.top = `${this.y}px`;
      this.container.style.width = `${this.width}px`;
      this.container.style.height = `${this.height}px`;

      this.focus();

      // 标题栏
      this.header = document.createElement("div");
      this.header.className = "win-native-header";

      const titleGroup = document.createElement("div");
      titleGroup.style.display = "flex";
      titleGroup.style.alignItems = "center";
      titleGroup.style.gap = "8px";
      titleGroup.style.maxWidth = "70%";
      titleGroup.style.overflow = "hidden";
      titleGroup.style.pointerEvents = "none";

      this.titleEl = document.createElement("h3");
      this.titleEl.className = "win-native-title";
      this.titleEl.innerText = this.options.title;
      titleGroup.appendChild(this.titleEl);

      const controls = document.createElement("div");
      controls.className = "win-ctrl-row";

      // 最小化
      this.btnMinimize = document.createElement("button");
      this.btnMinimize.type = "button";
      this.btnMinimize.className = "win-btn";
      this.btnMinimize.title = "最小化";
      this.btnMinimize.setAttribute("aria-label", "最小化");
      this.btnMinimize.innerHTML = `
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
        </svg>
      `;
      this.btnMinimize.addEventListener("click", (e) => {
        e.stopPropagation();
        this.minimize();
      });

      // 最大化/还原
      this.btnMaximize = document.createElement("button");
      this.btnMaximize.type = "button";
      this.btnMaximize.className = "win-btn";
      this.btnMaximize.title = "最大化";
      this.btnMaximize.setAttribute("aria-label", "最大化");
      this.btnMaximize.innerHTML = `
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <rect x="5" y="5" width="14" height="14" rx="1" />
        </svg>
      `;
      this.btnMaximize.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleMaximize();
      });

      // 关闭
      this.btnClose = document.createElement("button");
      this.btnClose.type = "button";
      this.btnClose.className = "win-btn win-btn-close";
      this.btnClose.title = "关闭";
      this.btnClose.setAttribute("aria-label", "关闭");
      this.btnClose.innerHTML = `
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      `;
      this.btnClose.addEventListener("click", (e) => {
        e.stopPropagation();
        this.close();
      });

      controls.appendChild(this.btnMinimize);
      controls.appendChild(this.btnMaximize);
      controls.appendChild(this.btnClose);

      this.header.appendChild(titleGroup);
      this.header.appendChild(controls);

      // 内容区
      this.contentEl = document.createElement("div");
      this.contentEl.className = "win-native-content";

      this.dragShield = document.createElement("div");
      this.dragShield.className = "win-native-dragshield";
      this.contentEl.appendChild(this.dragShield);

      if (this.options.content) {
        if (this.options.content instanceof HTMLElement) {
          this.contentEl.appendChild(this.options.content);
        } else {
          const contentWrapper = document.createElement("div");
          contentWrapper.className = "legal-window-root";
          contentWrapper.innerHTML = this.options.content;
          this.contentEl.appendChild(contentWrapper);
        }
      }

      // 缩放手柄
      this.resizeHandle = document.createElement("div");
      this.resizeHandle.className = "win-native-resize-handle";
      this.resizeHandle.innerHTML = `
        <svg width="8" height="8" viewBox="0 0 8 8" style="opacity: 0.6; color: currentColor;">
          <line x1="6" y1="2" x2="2" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <line x1="6" y1="4" x2="4" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      `;

      this.container.appendChild(this.header);
      this.container.appendChild(this.contentEl);
      this.container.appendChild(this.resizeHandle);
    }

    setTitle(newTitle) {
      this.options.title = newTitle;
      this.container.setAttribute("aria-label", newTitle);
      if (this.titleEl) {
        this.titleEl.innerText = newTitle;
      }
    }

    focus() {
      zCounter += 1;
      this.container.style.zIndex = String(zCounter);
    }

    setupEvents() {
      this.container.addEventListener("pointerdown", () => this.focus(), true);

      // 拖拽逻辑
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initX = 0;
      let initY = 0;

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let nextX = initX + dx;
        let nextY = initY + dy;

        // 边界吸附限制
        nextX = Math.max(0, Math.min(window.innerWidth - this.width, nextX));
        nextY = Math.max(0, Math.min(window.innerHeight - 40, nextY));

        this.x = nextX;
        this.y = nextY;
        this.container.style.left = `${nextX}px`;
        this.container.style.top = `${nextY}px`;
      };

      const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        if (this.dragShield) this.dragShield.style.display = "none";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      this.header.addEventListener("pointerdown", (e) => {
        if (this.isMaximized || window.innerWidth <= 680) return;
        if (e.target.closest("button")) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initX = this.x;
        initY = this.y;
        if (this.dragShield) this.dragShield.style.display = "block";
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      });

      this.header.addEventListener("dblclick", (e) => {
        if (e.target.closest("button") || window.innerWidth <= 680) return;
        this.toggleMaximize();
      });

      // 缩放手柄拖拽
      let isResizing = false;
      let startW = 0;
      let startH = 0;

      const onResizeMove = (e) => {
        if (!isResizing) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const nextW = Math.max(this.options.minWidth, Math.min(window.innerWidth - this.x, startW + dx));
        const nextH = Math.max(this.options.minHeight, Math.min(window.innerHeight - this.y, startH + dy));

        this.width = nextW;
        this.height = nextH;
        this.container.style.width = `${nextW}px`;
        this.container.style.height = `${nextH}px`;
      };

      const onResizeUp = () => {
        if (!isResizing) return;
        isResizing = false;
        if (this.dragShield) this.dragShield.style.display = "none";
        window.removeEventListener("pointermove", onResizeMove);
        window.removeEventListener("pointerup", onResizeUp);
      };

      this.resizeHandle.addEventListener("pointerdown", (e) => {
        if (this.isMaximized || window.innerWidth <= 680) return;
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = this.width;
        startH = this.height;
        if (this.dragShield) this.dragShield.style.display = "block";
        window.addEventListener("pointermove", onResizeMove);
        window.addEventListener("pointerup", onResizeUp);
      });
    }

    toggleMaximize() {
      if (this.isMaximized) {
        this.isMaximized = false;
        if (this.preMaximizedRect) {
          this.x = this.preMaximizedRect.x;
          this.y = this.preMaximizedRect.y;
          this.width = this.preMaximizedRect.w;
          this.height = this.preMaximizedRect.h;
        }
        this.container.style.left = `${this.x}px`;
        this.container.style.top = `${this.y}px`;
        this.container.style.width = `${this.width}px`;
        this.container.style.height = `${this.height}px`;
        this.container.classList.add("win-rounded");
        this.container.classList.remove("win-square");
        this.resizeHandle.style.display = "flex";
      } else {
        this.isMaximized = true;
        this.preMaximizedRect = { x: this.x, y: this.y, w: this.width, h: this.height };
        this.container.style.left = "0px";
        this.container.style.top = "0px";
        this.container.style.width = "100vw";
        this.container.style.height = "100vh";
        this.container.classList.remove("win-rounded");
        this.container.classList.add("win-square");
        this.resizeHandle.style.display = "none";
      }
      this.options.onMaximize(this.isMaximized);
    }

    minimize() {
      this.isMinimized = true;
      this.container.style.display = "none";
    }

    restore() {
      this.isMinimized = false;
      this.container.style.display = "flex";
      this.focus();
    }

    show() {
      if (!document.body.contains(this.container)) {
        document.body.appendChild(this.container);
      }
      requestAnimationFrame(() => {
        this.container.style.opacity = "1";
        this.container.style.transform = "scale(1) translateY(0)";
      });
    }

    close() {
      this.container.style.opacity = "0";
      this.container.style.transform = "scale(0.95) translateY(10px)";
      setTimeout(() => {
        if (this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
        const index = activeWindows.indexOf(this);
        if (index !== -1) activeWindows.splice(index, 1);
        this.options.onClose();
      }, 200);
    }
  }

  global.Win = Win;
})(window);
