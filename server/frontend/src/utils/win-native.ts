/**
 * Self-contained native Window class in pure HTML, CSS, and TypeScript.
 * Absolutely NO Tailwind CSS dependencies!
 * All gorgeous glassmorphic styles are dynamically injected into a document stylesheet.
 * Supports dragging, resizing, traffic light / square headers, minimal ball counters, and link embedding.
 */

export interface WinOptions {
  title?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  minWidth?: number;
  minHeight?: number;
  theme?: 'mac' | 'win';
  content?: string | HTMLElement;
  url?: string;
  onClose?: () => void;
  onMaximize?: (isMaximized: boolean) => void;
  onMini?: () => void;
  onResume?: () => void;
}

export class Win {
  // Global reference tracker for z-index boosting
  private static zCounter = 1000;
  private static activeWindows: Win[] = [];
  private static minimizedWindows: Win[] = [];
  private static ballElement: HTMLDivElement | null = null;
  private static ballPopup: HTMLDivElement | null = null;
  private static styleInjected: boolean = false;

  public container!: HTMLDivElement;
  public header!: HTMLDivElement;
  public contentEl!: HTMLDivElement;
  public iframeEl: HTMLIFrameElement | null = null;
  public dragShield: HTMLDivElement | null = null;
  public resizeHandle: HTMLDivElement | null = null;

  public options: Required<WinOptions> & {
    onClose?: () => void;
    onMaximize?: (isMaximized: boolean) => void;
    onMini?: () => void;
    onResume?: () => void;
  };
  
  public x: number = 0;
  public y: number = 0;
  public width: number = 0;
  public height: number = 0;
  
  public isMaximized: boolean = false;
  public isMinimized: boolean = false;
  private preMaximizedRect: { x: number; y: number; w: number; h: number } | null = null;

  constructor(options: WinOptions = {}) {
    Win.injectStyles();

    const defaultWidth = 720;
    const defaultHeight = 480;
    
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
    const defaultX = Math.max(16, (viewportWidth - defaultWidth) / 2 + (Win.activeWindows.length * 20) % 100);
    const defaultY = Math.max(16, (viewportHeight - defaultHeight) / 2 + (Win.activeWindows.length * 20) % 100);

    this.options = {
      title: options.title || 'Application',
      width: options.width || defaultWidth,
      height: options.height || defaultHeight,
      x: options.x !== undefined ? options.x : defaultX,
      y: options.y !== undefined ? options.y : defaultY,
      minWidth: options.minWidth || 320,
      minHeight: options.minHeight || 240,
      theme: options.theme || 'mac',
      content: options.content || '',
      url: options.url || '',
      onClose: options.onClose || (() => {}),
      onMaximize: options.onMaximize || (() => {}),
      onMini: options.onMini || (() => {}),
      onResume: options.onResume || (() => {}),
    };

    this.x = this.options.x;
    this.y = this.options.y;
    this.width = this.options.width;
    this.height = this.options.height;

    this.createDom();
    this.setupEvents();
    Win.activeWindows.push(this);
  }

  /**
   * Helper to ensure basic structural styling exists
   */
  private static injectStyles() {
    if (this.styleInjected || typeof document === 'undefined') return;
    this.styleInjected = true;

    const css = `
      :root {
        --win-primary: #6366f1;
        --win-primary-hex: rgba(99, 102, 241, 0.12);
        --win-bg-light: rgba(255, 255, 255, 0.82);
        --win-bg-dark: rgba(23, 23, 23, 0.85);
        --win-border-light: rgba(0, 0, 0, 0.1);
        --win-border-dark: rgba(255, 255, 255, 0.12);
        --win-text-light: #1f2937;
        --win-text-dark: #f3f4f6;
      }

      /* Styles for the main window container */
      .win-native-container {
        position: fixed;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        transition: opacity 0.2s ease-out, transform 0.2s ease-out;
        box-sizing: border-box;
      }

      /* Theme colors mapping dynamically using light/dark preferences */
      @media (prefers-color-scheme: dark) {
        .win-native-container {
          background-color: var(--win-bg-dark);
          color: var(--win-text-dark);
          border: 1px solid var(--win-border-dark);
        }
      }
      @media (prefers-color-scheme: light) {
        .win-native-container {
          background-color: var(--win-bg-light);
          color: var(--win-text-light);
          border: 1px solid var(--win-border-light);
        }
      }

      /* Forcing overrides depending on root CSS styles */
      .dark .win-native-container, [data-theme="dark"] .win-native-container {
        background-color: var(--win-bg-dark);
        color: var(--win-text-dark);
        border: 1px solid var(--win-border-dark);
      }
      .light .win-native-container, [data-theme="light"] .win-native-container {
        background-color: var(--win-bg-light);
        color: var(--win-text-light);
        border: 1px solid var(--win-border-light);
      }

      .win-native-container.win-rounded {
        border-radius: 16px;
      }
      .win-native-container.win-square {
        border-radius: 0px;
      }

      /* Backdrop Blur Filter if supported */
      @supports (backdrop-filter: blur(20px)) {
        .win-native-container {
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
      }

      /* Header Style definitions */
      .win-native-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 48px;
        padding: 0 16px;
        cursor: grab;
        border-bottom: 1px solid rgba(128, 128, 128, 0.12);
        box-sizing: border-box;
        position: relative;
        flex-shrink: 0;
      }
      .win-native-header:active {
        cursor: grabbing;
      }

      .win-native-title {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 13px;
        font-weight: 700;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0.85;
      }

      .win-native-content {
        flex: 1;
        width: 100%;
        overflow: hidden;
        position: relative;
        box-sizing: border-box;
      }

      .win-native-dragshield {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: transparent;
        z-index: 999;
        display: none;
      }

      .win-native-iframe {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
      }

      .win-native-html-scrollable {
        width: 100%;
        height: 100%;
        overflow: auto;
        box-sizing: border-box;
      }

      /* Resize visual controls bottom-right */
      .win-native-resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: se-resize;
        z-index: 1000;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        padding: 2px;
        box-sizing: border-box;
      }

      /* Mac Head Controls group styling */
      .mac-dots-row {
        display: flex;
        align-items: center;
        gap: 10px;
        user-select: none;
        flex-shrink: 0;
        z-index: 10;
        width: 96px;
      }

      .mac-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        transition: transform 0.15s ease, background-color 0.15s ease;
        border: 1px solid rgba(0, 0, 0, 0.05);
        padding: 0;
        box-sizing: border-box;
      }
      .mac-dot:hover {
        transform: scale(1.05);
      }

      .mac-dot-close {
        background-color: #f43f5e;
        border-color: rgba(225, 29, 72, 0.4);
      }
      .mac-dot-close:hover {
        background-color: #e11d48;
      }

      .mac-dot-minimize {
        background-color: #f59e0b;
        border-color: rgba(217, 119, 6, 0.4);
      }
      .mac-dot-minimize:hover {
        background-color: #d97706;
      }

      .mac-dot-zoom {
        background-color: #10b981;
        border-color: rgba(5, 150, 105, 0.4);
      }
      .mac-dot-zoom:hover {
        background-color: #059669;
      }

      .mac-dot-svg {
        width: 8px;
        height: 8px;
        opacity: 0;
        transition: opacity 0.15s ease;
      }
      .mac-dots-row:hover .mac-dot-svg {
        opacity: 1;
      }

      /* Windows Header controls styling */
      .win-ctrl-row {
        display: flex;
        align-items: center;
        user-select: none;
        flex-shrink: 0;
        height: 100%;
      }

      .win-btn {
        height: 100%;
        padding: 0 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: transparent;
        border: none;
        color: inherit;
        opacity: 0.6;
        transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
        box-sizing: border-box;
      }
      .win-btn:hover {
        background-color: rgba(128, 128, 128, 0.15);
        opacity: 1;
      }

      .win-btn-close:hover {
        background-color: #ef4444 !important;
        color: #ffffff !important;
        opacity: 1;
      }

      /* Floating orb system container styling */
      .win-floating-ball {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
        background-color: rgba(15, 23, 42, 0.95);
        color: #ffffff;
        user-select: none;
        box-sizing: border-box;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 0 24px -2px rgba(99, 102, 241, 0.4), 0 10px 25px -10px rgba(0, 0, 0, 0.6);
      }
      .win-floating-ball:hover {
        background-color: rgba(30, 41, 59, 0.98);
        transform: translateY(-2px);
      }

      .dark .win-floating-ball {
        background-color: rgba(8, 13, 28, 0.95);
        border-color: rgba(255, 255, 255, 0.1);
      }

      .win-ball-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        background-color: #6366f1;
        color: #ffffff;
        font-family: system-ui, sans-serif;
        font-size: 10px;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.2)
      }

      /* Mini popup menu containing minimized records */
      .win-popup-menu {
        position: fixed;
        bottom: 88px;
        right: 24px;
        z-index: 99998;
        width: 256px;
        max-height: 288px;
        overflow-y: auto;
        border-radius: 16px;
        background-color: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 12px 36px rgba(0,0,0,0.5);
        padding: 8px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 4px;
        transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
        font-family: system-ui, sans-serif;
      }
      
      .dark .win-popup-menu {
        background-color: rgba(8, 13, 28, 0.96);
        border-color: rgba(255, 255, 255, 0.1);
      }

      .win-popup-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        border-bottom: 1px solid rgba(128, 128, 128, 0.15);
        margin-bottom: 4px;
        font-size: 10px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .win-restore-all {
        background: none;
        border: none;
        color: #818cf8;
        font-size: 9px;
        font-weight: 800;
        cursor: pointer;
        padding: 0;
      }
      .win-restore-all:hover {
        color: #ffffff;
      }

      .win-popup-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 10px;
        cursor: pointer;
        transition: background-color 0.15s ease;
        box-sizing: border-box;
        gap: 8px;
      }
      .win-popup-item:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }

      .win-popup-info {
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 80%;
        overflow: hidden;
      }

      .win-popup-title {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .win-popup-close-item {
        background: transparent;
        border: none;
        border-radius: 6px;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.4);
        transition: background-color 0.15s ease, color 0.15s ease;
        padding: 0;
      }
      .win-popup-close-item:hover {
        background-color: #f43f5e;
        color: #ffffff;
      }

      .win-popup-icon {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .win-popup-svg-fallback {
        width: 16px;
        height: 16px;
        color: #818cf8;
        flex-shrink: 0;
      }
    `;

    const el = document.createElement('style');
    el.id = 'win-native-embedded-styles';
    el.innerHTML = css;
    document.head.appendChild(el);
  }

  /**
   * Generates the entire DOM hierarchy of the Window container.
   */
  private createDom() {
    this.container = document.createElement('div');
    this.container.id = `win-native-[uid-${Date.now()}-${Math.floor(Math.random() * 1000)}]`;
    
    // Set standard class names
    this.container.classList.add('win-native-container', 'win-rounded');
    
    // Reduced active shadow size for standard desktop ergonomics (applied directly in CSS styled objects below)
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.95) translateY(10px)';
    this.container.style.left = `${this.x}px`;
    this.container.style.top = `${this.y}px`;
    this.container.style.width = `${this.width}px`;
    this.container.style.height = `${this.height}px`;

    // Boost z-index immediately for new windows
    this.focus();

    // Create Header element with standard class helper
    this.header = document.createElement('div');
    this.header.className = 'win-native-header';
    
    // Header controls and title structure depending on macOS / Windows styles
    if (this.options.theme === 'mac') {
      this.buildMacHeader();
    } else {
      this.buildWinHeader();
    }

    // Create Content Panel Container
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'win-native-content';

    // Drag-shield: covers content during drag to prevent drag-over-iframe issues
    this.dragShield = document.createElement('div');
    this.dragShield.className = 'win-native-dragshield';
    this.contentEl.appendChild(this.dragShield);

    // Populate contents (Html code fragment or IFRAME URL)
    if (this.options.url) {
      this.iframeEl = document.createElement('iframe');
      this.iframeEl.className = 'win-native-iframe';
      this.iframeEl.src = this.options.url;
      this.iframeEl.referrerPolicy = 'no-referrer';
      this.contentEl.appendChild(this.iframeEl);
    } else if (this.options.content) {
      if (this.options.content instanceof HTMLElement) {
        this.contentEl.appendChild(this.options.content);
      } else {
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'win-native-html-scrollable';
        contentWrapper.innerHTML = this.options.content;
        this.contentEl.appendChild(contentWrapper);
      }
    }

    // Resize Handle (Bottom-Right corner)
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'win-native-resize-handle';
    // Diagonal dots indicator
    this.resizeHandle.innerHTML = `
      <svg width="8" height="8" viewBox="0 0 8 8" style="opacity: 0.6; color: currentColor;">
        <line x1="6" y1="2" x2="2" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <line x1="6" y1="4" x2="4" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    `;

    // Package inside container
    this.container.appendChild(this.header);
    this.container.appendChild(this.contentEl);
    this.container.appendChild(this.resizeHandle);
  }

  /**
   * macOS layout - Traffic light controls on the left, centered title
   */
  private buildMacHeader() {
    // 3 MacOS Dots Group close on hover
    const controls = document.createElement('div');
    controls.className = 'mac-dots-row';

    // Close button (Red)
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'mac-dot mac-dot-close';
    btnClose.innerHTML = `
      <svg class="mac-dot-svg" fill="none" viewBox="0 0 24 24" stroke="#4c0519" stroke-width="4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Minimize button (Yellow)
    const btnMinimize = document.createElement('button');
    btnMinimize.type = 'button';
    btnMinimize.className = 'mac-dot mac-dot-minimize';
    btnMinimize.innerHTML = `
      <svg class="mac-dot-svg" fill="none" viewBox="0 0 24 24" stroke="#78350f" stroke-width="4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
      </svg>
    `;
    btnMinimize.addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimize();
    });

    // Maximize/Zoom button (Green)
    const btnMaximize = document.createElement('button');
    btnMaximize.type = 'button';
    btnMaximize.className = 'mac-dot mac-dot-zoom';
    btnMaximize.innerHTML = `
      <svg class="mac-dot-svg" fill="none" viewBox="0 0 24 24" stroke="#064e3b" stroke-width="3.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 3H3v5M16 21h5v-5M16 3h5v5M8 21H3v-5" />
      </svg>
    `;
    btnMaximize.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize();
    });

    controls.appendChild(btnClose);
    controls.appendChild(btnMinimize);
    controls.appendChild(btnMaximize);

    // Title centered
    const title = document.createElement('h3');
    title.className = 'win-native-title';
    title.style.position = 'absolute';
    title.style.left = '0';
    title.style.right = '0';
    title.style.margin = 'auto';
    title.style.textAlign = 'center';
    title.style.pointerEvents = 'none';
    title.style.maxWidth = '50%';
    title.innerText = this.options.title;

    // Blank balanced space (or browser fallback button if url is present)
    const spacer = document.createElement('div');
    spacer.style.width = '96px';
    spacer.style.display = 'flex';
    spacer.style.justifyContent = 'flex-end';
    spacer.style.alignItems = 'center';
    spacer.style.gap = '6px';
    spacer.style.zIndex = '10';
    spacer.style.flexShrink = '0';

    if (this.options.url) {
      const btnBrowser = document.createElement('button');
      btnBrowser.type = 'button';
      btnBrowser.title = 'Open in Browser';
      btnBrowser.style.width = '24px';
      btnBrowser.style.height = '24px';
      btnBrowser.style.borderRadius = '8px';
      btnBrowser.style.backgroundColor = 'transparent';
      btnBrowser.style.border = 'none';
      btnBrowser.style.color = 'currentColor';
      btnBrowser.style.opacity = '0.6';
      btnBrowser.style.cursor = 'pointer';
      btnBrowser.style.display = 'flex';
      btnBrowser.style.alignItems = 'center';
      btnBrowser.style.justifyContent = 'center';
      btnBrowser.style.transition = 'all 0.15s ease';

      btnBrowser.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      `;
      btnBrowser.addEventListener('mouseenter', () => btnBrowser.style.opacity = '1');
      btnBrowser.addEventListener('mouseleave', () => btnBrowser.style.opacity = '0.6');
      btnBrowser.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(this.options.url, '_blank');
      });
      spacer.appendChild(btnBrowser);
    }

    this.header.appendChild(controls);
    this.header.appendChild(title);
    this.header.appendChild(spacer);
  }

  /**
   * Windows layout - Title on left, utility standard items on right
   */
  private buildWinHeader() {
    // Title Left
    const titleGroup = document.createElement('div');
    titleGroup.style.display = 'flex';
    titleGroup.style.alignItems = 'center';
    titleGroup.style.gap = '8px';
    titleGroup.style.maxWidth = '65%';
    titleGroup.style.overflow = 'hidden';
    titleGroup.style.pointerEvents = 'none';
    
    const title = document.createElement('h3');
    title.className = 'win-native-title';
    title.innerText = this.options.title;
    titleGroup.appendChild(title);

    // Controls Right
    const controls = document.createElement('div');
    controls.className = 'win-ctrl-row';

    // Red Cross hover
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'win-btn win-btn-close';
    btnClose.innerHTML = `
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Square grid
    const btnMaximize = document.createElement('button');
    btnMaximize.type = 'button';
    btnMaximize.className = 'win-btn';
    btnMaximize.innerHTML = `
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <rect x="5" y="5" width="14" height="14" rx="1" />
      </svg>
    `;
    btnMaximize.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize();
    });

    // Minimize button
    const btnMinimize = document.createElement('button');
    btnMinimize.type = 'button';
    btnMinimize.className = 'win-btn';
    btnMinimize.innerHTML = `
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
      </svg>
    `;
    btnMinimize.addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimize();
    });

    if (this.options.url) {
      const btnBrowser = document.createElement('button');
      btnBrowser.type = 'button';
      btnBrowser.title = 'Open in Browser';
      btnBrowser.className = 'win-btn';
      btnBrowser.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      `;
      btnBrowser.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(this.options.url, '_blank');
      });
      controls.appendChild(btnBrowser);
    }

    controls.appendChild(btnMinimize);
    controls.appendChild(btnMaximize);
    controls.appendChild(btnClose);

    this.header.appendChild(titleGroup);
    this.header.appendChild(controls);
  }

  /**
   * Sets up drag boundaries and pointer resize handlers
   */
  private setupEvents() {
    // Focus Booster on interaction
    this.container.addEventListener('pointerdown', () => this.focus());

    // Drag-by-Header Logic
    let isDragging = false;
    let initialX = 0;
    let initialY = 0;
    let windowStartX = 0;
    let windowStartY = 0;

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      const deltaX = e.clientX - initialX;
      const deltaY = e.clientY - initialY;

      let nextX = windowStartX + deltaX;
      let nextY = windowStartY + deltaY;

      // Ensure window header has viewport visibility
      const buffer = 40;
      nextX = Math.max(-this.width + buffer, Math.min(window.innerWidth - buffer, nextX));
      nextY = Math.max(0, Math.min(window.innerHeight - buffer, nextY));

      this.x = nextX;
      this.y = nextY;
      
      this.container.style.left = `${this.x}px`;
      this.container.style.top = `${this.y}px`;
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      this.dragShield!.style.display = 'none';
      
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    this.header.addEventListener('pointerdown', (e) => {
      if (this.isMaximized) return;
      
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;

      isDragging = true;
      initialX = e.clientX;
      initialY = e.clientY;
      windowStartX = this.x;
      windowStartY = this.y;

      this.dragShield!.style.display = 'block';

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      
      e.preventDefault();
    });

    // Resize Handle (Pointer events to track precisely)
    let isResizing = false;
    let resizeStartWidth = 0;
    let resizeStartHeight = 0;
    let resizeClientX = 0;
    let resizeClientY = 0;

    const onResizeMove = (e: PointerEvent) => {
      if (!isResizing) return;
      e.preventDefault();

      const calculatedWidth = resizeStartWidth + (e.clientX - resizeClientX);
      const calculatedHeight = resizeStartHeight + (e.clientY - resizeClientY);

      this.width = Math.max(this.options.minWidth, Math.min(window.innerWidth, calculatedWidth));
      this.height = Math.max(this.options.minHeight, Math.min(window.innerHeight, calculatedHeight));

      this.container.style.width = `${this.width}px`;
      this.container.style.height = `${this.height}px`;
    };

    const onResizeUp = () => {
      if (!isResizing) return;
      isResizing = false;
      this.dragShield!.style.display = 'none';
      
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', onResizeUp);
    };

    this.resizeHandle?.addEventListener('pointerdown', (e) => {
      if (this.isMaximized) return;
      e.stopPropagation();
      e.preventDefault();

      isResizing = true;
      resizeStartWidth = this.width;
      resizeStartHeight = this.height;
      resizeClientX = e.clientX;
      resizeClientY = e.clientY;

      this.dragShield!.style.display = 'block';

      window.addEventListener('pointermove', onResizeMove);
      window.addEventListener('pointerup', onResizeUp);
    });

    this.header.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      this.toggleMaximize();
    });
  }

  /**
   * Promotes window above other window DOM groups
   */
  public focus() {
    Win.zCounter++;
    this.container.style.zIndex = `${Win.zCounter}`;
    
    // Aesthetic focal feedback: shadow adjustments
    Win.activeWindows.forEach(w => {
      if (w !== this) {
        w.container.style.boxShadow = '0 4px 12px -2px rgba(0, 0, 0, 0.12), 0 2px 4px -2px rgba(0, 0, 0, 0.12)';
      }
    });

    this.container.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.2), 0 0 16px -4px var(--win-primary-hex, rgba(99, 102, 241, 0.12))';
  }

  /**
   * Toggles window zoom state (maximize viewport vs. window default layout)
   */
  public toggleMaximize() {
    if (this.isMaximized) {
      this.isMaximized = false;
      this.container.classList.remove('win-square');
      this.container.classList.add('win-rounded');

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
    } else {
      this.isMaximized = true;
      this.preMaximizedRect = {
        x: this.x,
        y: this.y,
        w: this.width,
        h: this.height
      };

      this.container.classList.remove('win-rounded');
      this.container.classList.add('win-square');

      this.container.style.left = '0px';
      this.container.style.top = '0px';
      this.container.style.width = '100vw';
      this.container.style.height = '100vh';
    }

    if (this.options.onMaximize) {
      this.options.onMaximize(this.isMaximized);
    }
  }

  /**
   * Appends window wrapper directly onto the body viewport
   */
  public show() {
    if (document.getElementById(this.container.id)) return this;

    document.body.appendChild(this.container);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.container.style.opacity = '1';
        this.container.style.transform = 'scale(1) translateY(0px)';
      });
    });

    return this;
  }

  /**
   * Shuts down UI wrapper, triggers onClose, removes DOM references.
   */
  public close() {
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.95) translateY(10px)';

    Win.minimizedWindows = Win.minimizedWindows.filter(w => w !== this);
    Win.updateFloatingBall();

    setTimeout(() => {
      this.container.remove();
      Win.activeWindows = Win.activeWindows.filter(w => w !== this);
      if (this.options.onClose) {
        this.options.onClose();
      }
    }, 200);
  }

  /**
   * Minimizes the window beautiful into the lower-right corner floating orb
   */
  public minimize() {
    if (this.isMinimized) return;
    this.isMinimized = true;

    const rect = this.container.getBoundingClientRect();
    const ballX = window.innerWidth - 80;
    const ballY = window.innerHeight - 80;

    this.container.style.transition = 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
    this.container.style.opacity = '0';
    this.container.style.transform = `translate(${ballX - rect.left - rect.width/2}px, ${ballY - rect.top - rect.height/2}px) scale(0.05)`;
    this.container.style.pointerEvents = 'none';

    setTimeout(() => {
      if (this.isMinimized) {
        this.container.style.visibility = 'hidden';
      }
    }, 350);

    if (!Win.minimizedWindows.includes(this)) {
      Win.minimizedWindows.push(this);
    }
    Win.updateFloatingBall();

    if (this.options.onMini) {
      this.options.onMini();
    }
  }

  /**
   * Restores a minimized window back onto active workspace focus
   */
  public restore() {
    if (!this.isMinimized) return;
    this.isMinimized = false;

    Win.minimizedWindows = Win.minimizedWindows.filter(w => w !== this);
    Win.updateFloatingBall();

    this.focus();
    this.container.style.visibility = 'visible';
    this.container.style.pointerEvents = 'auto';
    this.container.style.transition = 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
    
    this.container.style.opacity = '1';
    this.container.style.transform = 'scale(1) translateY(0)';

    setTimeout(() => {
      this.container.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
    }, 350);

    if (this.options.onResume) {
      this.options.onResume();
    }
  }

  /**
   * Updates state, elements, badges, and popups of the minimized windows floating ball
   */
  public static updateFloatingBall() {
    if (typeof document === 'undefined') return;

    const count = Win.minimizedWindows.length;

    // Destroy balls and menus if no windows are minimized
    if (count === 0) {
      if (Win.ballElement) {
        Win.ballElement.style.opacity = '0';
        Win.ballElement.style.transform = 'scale(0.8) translateY(10px)';
        const el = Win.ballElement;
        setTimeout(() => el.remove(), 250);
        Win.ballElement = null;
      }
      if (Win.ballPopup) {
        Win.ballPopup.remove();
        Win.ballPopup = null;
      }
      return;
    }

    // Spawn ball module if missing
    if (!Win.ballElement) {
      Win.ballElement = document.createElement('div');
      Win.ballElement.className = 'win-floating-ball';
      
      Win.ballElement.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          <svg style="width: 24px; height: 24px; opacity: 0.85; transition: transform 0.3s ease;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="2 2" style="opacity: 0.4;" />
            <rect x="7" y="7" width="14" height="14" rx="2" />
          </svg>
          <div id="win-native-ball-badge" class="win-ball-badge">
            ${count}
          </div>
        </div>
      `;

      Win.ballElement.addEventListener('click', (e) => {
        e.stopPropagation();
        Win.togglePopup();
      });

      document.body.appendChild(Win.ballElement);
    } else {
      const badge = document.getElementById('win-native-ball-badge');
      if (badge) {
        badge.innerText = `${count}`;
      }
    }

    Win.repopulatePopup();
  }

  /**
   * Toggles the list popup panel above the floating ball
   */
  public static togglePopup(show?: boolean) {
    if (!Win.ballPopup) return;
    const isHidden = Win.ballPopup.style.display === 'none';
    const targetShow = show !== undefined ? show : isHidden;

    if (targetShow) {
      Win.ballPopup.style.display = 'flex';
      requestAnimationFrame(() => {
        if (Win.ballPopup) {
          Win.ballPopup.style.opacity = '1';
          Win.ballPopup.style.transform = 'scale(1) translateY(0)';
        }
      });
    } else {
      if (Win.ballPopup) {
        Win.ballPopup.style.opacity = '0';
        Win.ballPopup.style.transform = 'scale(0.95) translateY(10px)';
        const popup = Win.ballPopup;
        setTimeout(() => {
          if (!Win.ballElement || Win.minimizedWindows.length === 0) return;
          popup.style.display = 'none';
        }, 200);
      }
    }
  }

  /**
   * Refreshes popup structure dynamically row by row
   */
  private static repopulatePopup() {
    if (typeof document === 'undefined') return;

    if (!Win.ballPopup) {
      Win.ballPopup = document.createElement('div');
      Win.ballPopup.className = 'win-popup-menu';
      Win.ballPopup.style.display = 'none';
      document.body.appendChild(Win.ballPopup);

      document.addEventListener('click', () => {
        Win.togglePopup(false);
      });
      Win.ballPopup.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    Win.ballPopup.innerHTML = '';

    const headerEl = document.createElement('div');
    headerEl.className = 'win-popup-header';
    headerEl.innerHTML = `
      <span>最小化的窗口</span>
      <button class="win-restore-all" id="win-restore-all-native">恢复全部</button>
    `;
    Win.ballPopup.appendChild(headerEl);

    const restoreAllBtn = headerEl.querySelector('#win-restore-all-native');
    restoreAllBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const items = [...Win.minimizedWindows];
      items.forEach(w => w.restore());
      Win.togglePopup(false);
    });

    Win.minimizedWindows.forEach((winItem) => {
      const row = document.createElement('div');
      row.className = 'win-popup-item';
      
      const info = document.createElement('div');
      info.className = 'win-popup-info';
      
      let iconHtml = `
        <svg class="win-popup-svg-fallback" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      `;
      if (winItem.options.url) {
        iconHtml = `
          <img src="https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(winItem.options.url)}" class="win-popup-icon" onerror="this.onerror=null; this.style.display='none';">
        `;
      }

      info.innerHTML = `
        ${iconHtml}
        <span class="win-popup-title">${winItem.options.title}</span>
      `;

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        winItem.restore();
        
        if (Win.minimizedWindows.length === 0) {
          Win.togglePopup(false);
        }
      });

      const btnItemClose = document.createElement('button');
      btnItemClose.title = '关闭窗口';
      btnItemClose.className = 'win-popup-close-item';
      btnItemClose.innerHTML = `
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      `;
      btnItemClose.addEventListener('click', (e) => {
        e.stopPropagation();
        winItem.close();
      });

      row.appendChild(info);
      row.appendChild(btnItemClose);
      Win.ballPopup?.appendChild(row);
    });
  }

  /**
   * Destroys all open floating system windows immediately.
   */
  public static closeAll() {
    const list = [...Win.activeWindows];
    list.forEach(w => w.close());
    Win.minimizedWindows = [];
    Win.updateFloatingBall();
  }
}
