/**
 * Lightweight, highly polished native Window class in TypeScript.
 * Creates an elegant, draggable, and resizable window with support for 
 * custom HTML content, element mounting, or iframes (cross-origin webpages).
 * Styled perfectly to match the current slate glassmorphism theme of the desktop.
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
    // Merge options with premium defaults
    const defaultWidth = 720;
    const defaultHeight = 480;
    
    // Automatically center if x/y aren't provided
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
   * Generates the entire DOM hierarchy of the Window container.
   */
  private createDom() {
    this.container = document.createElement('div');
    this.container.id = `win-[uid-${Date.now()}-${Math.floor(Math.random() * 1000)}]`;
    
    // Beautiful glassmorphic background & panel classes (reduced shadow size for elegance)
    this.container.className = 'fixed rounded-2xl glass-panel shadow-lg flex flex-col overflow-hidden border border-white/20 dark:border-white/10 select-none transition-[opacity,transform] duration-200 ease-out';
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.95) translateY(10px)';
    this.container.style.left = `${this.x}px`;
    this.container.style.top = `${this.y}px`;
    this.container.style.width = `${this.width}px`;
    this.container.style.height = `${this.height}px`;

    // Boost z-index immediately for new windows
    this.focus();

    // Create Header
    this.header = document.createElement('div');
    this.header.className = 'flex items-center justify-between h-12 px-4 cursor-grab active:cursor-grabbing border-b border-foreground/10 bg-foreground/5 backdrop-blur-md select-none shrink-0 relative';
    
    // Header controls and title structure depending on macOS / Windows styles
    if (this.options.theme === 'mac') {
      this.buildMacHeader();
    } else {
      this.buildWinHeader();
    }

    // Create Content Panel Container
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'flex-1 w-full overflow-hidden bg-background/30 dark:bg-black/30 relative';

    // Drag-shield: covers content during drag to prevent drag-over-iframe issues
    this.dragShield = document.createElement('div');
    this.dragShield.className = 'absolute inset-0 bg-transparent hidden z-50 pointer-events-auto';
    this.contentEl.appendChild(this.dragShield);

    // Populate contents (Html code fragment or IFRAME URL)
    if (this.options.url) {
      this.iframeEl = document.createElement('iframe');
      this.iframeEl.className = 'w-full h-full border-none bg-black/5 dark:bg-white/5';
      this.iframeEl.src = this.options.url;
      this.iframeEl.referrerPolicy = 'no-referrer';
      this.contentEl.appendChild(this.iframeEl);
    } else if (this.options.content) {
      if (this.options.content instanceof HTMLElement) {
        this.contentEl.appendChild(this.options.content);
      } else {
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'w-full h-full overflow-auto text-foreground';
        contentWrapper.innerHTML = this.options.content;
        this.contentEl.appendChild(contentWrapper);
      }
    }

    // Resize Handle (Bottom-Right corner)
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-[60] flex items-end justify-end p-0.5';
    // Diagonal dots indicator
    this.resizeHandle.innerHTML = `
      <svg width="8" height="8" viewBox="0 0 8 8" class="text-foreground/40 opacity-70 group-hover:opacity-100 transition-opacity">
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
   * macOS layout - Traffic light controls on the left, centered title.
   * Upgraded to provide larger buttons that are easier to interact with.
   */
  private buildMacHeader() {
    // 3 MacOS Dots Group close on hover
    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-2.5 group/dots select-none shrink-0 z-10 w-24';

    // Close button (Red)
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'w-3.5 h-3.5 rounded-full bg-rose-500 hover:bg-rose-600 transition-all flex items-center justify-center relative shadow-sm cursor-pointer border border-rose-600/30 hover:scale-105';
    btnClose.innerHTML = `
      <svg class="opacity-0 group-hover/dots:opacity-100 transition-opacity w-2 h-2 text-rose-950 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="4">
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
    btnMinimize.className = 'w-3.5 h-3.5 rounded-full bg-amber-500 hover:bg-amber-600 transition-all flex items-center justify-center relative shadow-sm cursor-pointer border border-amber-600/30 hover:scale-105';
    btnMinimize.innerHTML = `
      <svg class="opacity-0 group-hover/dots:opacity-100 transition-opacity w-2 h-2 text-amber-950 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="4">
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
    btnMaximize.className = 'w-3.5 h-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center relative shadow-sm cursor-pointer border border-emerald-600/30 hover:scale-105';
    btnMaximize.innerHTML = `
      <svg class="opacity-0 group-hover/dots:opacity-100 transition-opacity w-2 h-2 text-emerald-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5">
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
    title.className = 'absolute inset-x-0 mx-auto text-center pointer-events-none text-xs font-bold text-foreground/80 flex items-center justify-center h-full max-w-[50%] truncate font-sans';
    title.innerText = this.options.title;

    // Blank balanced space (or browser fallback button if url is present)
    const spacer = document.createElement('div');
    spacer.className = 'w-24 shrink-0 flex justify-end items-center gap-1.5 z-10';
    if (this.options.url) {
      const btnBrowser = document.createElement('button');
      btnBrowser.type = 'button';
      btnBrowser.title = 'Open in Browser';
      btnBrowser.className = 'w-6 h-6 rounded-lg hover:bg-foreground/15 text-foreground/60 hover:text-foreground flex items-center justify-center transition-all cursor-pointer';
      btnBrowser.innerHTML = `
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      `;
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
    titleGroup.className = 'flex items-center gap-2 max-w-[65%] truncate pointer-events-none';
    
    const title = document.createElement('h3');
    title.className = 'text-xs font-bold text-foreground/80 font-sans truncate';
    title.innerText = this.options.title;
    titleGroup.appendChild(title);

    // Controls Right
    const controls = document.createElement('div');
    controls.className = 'flex items-center select-none shrink-0 h-full';

    // Red Cross hover
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'h-full px-3.5 hover:bg-rose-500 hover:text-white transition-colors duration-150 flex items-center justify-center cursor-pointer text-foreground/60';
    btnClose.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
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
    btnMaximize.className = 'h-full px-3.5 hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors duration-150 flex items-center justify-center cursor-pointer text-foreground/60';
    btnMaximize.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <rect x="5" y="5" width="14" height="14" rx="1" />
      </svg>
    `;
    btnMaximize.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize();
    });

    // Horizontal line
    const btnMinimize = document.createElement('button');
    btnMinimize.type = 'button';
    btnMinimize.className = 'h-full px-3.5 hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors duration-150 flex items-center justify-center cursor-pointer text-foreground/60 opacity-60 hover:opacity-100';
    btnMinimize.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
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
      btnBrowser.className = 'h-full px-3.5 hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors duration-150 flex items-center justify-center cursor-pointer text-foreground/60 hover:text-foreground';
      btnBrowser.innerHTML = `
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

      // Ensure window header has viewport visibility (at least some buffer)
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
      this.container.classList.remove('dragging');
      this.dragShield?.classList.add('hidden');
      
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    this.header.addEventListener('pointerdown', (e) => {
      // Ignore if maximize is checked
      if (this.isMaximized) return;
      // Also ignore if clicking inside header controls
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;

      isDragging = true;
      initialX = e.clientX;
      initialY = e.clientY;
      windowStartX = this.x;
      windowStartY = this.y;

      this.container.classList.add('dragging');
      // Reveal drag shield to capture mouse movements on top of inside iframe
      this.dragShield?.classList.remove('hidden');

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
      this.dragShield?.classList.add('hidden');
      
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

      this.dragShield?.classList.remove('hidden');

      window.addEventListener('pointermove', onResizeMove);
      window.addEventListener('pointerup', onResizeUp);
    });

    // Maximize header double click toggling
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
    
    // Aesthetic focal feedback: shadow enhance
    Win.activeWindows.forEach(w => {
      if (w !== this) {
        w.container.classList.remove('shadow-primary/30');
        w.container.style.boxShadow = '0 4px 12px -2px rgba(0, 0, 0, 0.12), 0 2px 4px -2px rgba(0, 0, 0, 0.12)';
      }
    });
    // Reduced active shadow size for standard desktop ergonomics
    this.container.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.2), 0 0 16px -4px var(--primary-hex, rgba(99, 102, 241, 0.12))';
  }

  /**
   * Toggles window zoom state (maximize viewport vs. window default layout)
   */
  public toggleMaximize() {
    if (this.isMaximized) {
      // Revert standard layout
      this.isMaximized = false;
      this.container.classList.remove('rounded-none');
      this.container.classList.add('rounded-2xl');

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
      // Maximization action
      this.isMaximized = true;
      // Record normal rect for recovery
      this.preMaximizedRect = {
        x: this.x,
        y: this.y,
        w: this.width,
        h: this.height
      };

      this.container.classList.remove('rounded-2xl');
      this.container.classList.add('rounded-none');

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

    // Scale up rendering frames beautifully
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.container.style.opacity = '1';
        this.container.style.transform = 'scale(1) translateY(0px)';
      });
    });

    return this;
  }

  /**
   * Shuts down UI wrapper, triggers onClose, removes DOM references and updates status ball.
   */
  public close() {
    // Fade out animations
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
      Win.ballElement.className = 'fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-xl bg-slate-900/90 hover:bg-slate-800/95 dark:bg-slate-950/90 dark:hover:bg-slate-900/95 text-white select-none border border-white/20 dark:border-white/10 opacity-0 scale-90 translate-y-4';
      Win.ballElement.style.boxShadow = '0 0 20px -2px var(--primary-hex, rgba(99, 102, 241, 0.4)), 0 10px 25px -10px rgba(0, 0, 0, 0.5)';
      
      Win.ballElement.innerHTML = `
        <div class="relative w-full h-full flex items-center justify-center">
          <svg class="w-6 h-6 opacity-85 transition-transform duration-300 hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="2 2" class="opacity-40" />
            <rect x="7" y="7" width="14" height="14" rx="2" />
          </svg>
          <div id="win-ball-badge" class="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-500 dark:bg-indigo-600 text-[10px] font-black flex items-center justify-center shadow-lg animate-pulse border border-white/15">
            ${count}
          </div>
        </div>
      `;

      Win.ballElement.addEventListener('click', (e) => {
        e.stopPropagation();
        Win.togglePopup();
      });

      document.body.appendChild(Win.ballElement);

      requestAnimationFrame(() => {
        if (Win.ballElement) {
          Win.ballElement.style.opacity = '1';
          Win.ballElement.style.transform = 'scale(1) translateY(0)';
        }
      });
    } else {
      const badge = document.getElementById('win-ball-badge');
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
    const isHidden = Win.ballPopup.classList.contains('hidden');
    const targetShow = show !== undefined ? show : isHidden;

    if (targetShow) {
      Win.ballPopup.classList.remove('hidden');
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
          popup.classList.add('hidden');
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
      Win.ballPopup.className = 'fixed bottom-22 right-6 z-[9998] w-64 max-h-72 overflow-y-auto rounded-2xl border border-white/15 dark:border-white/10 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl shadow-2xl p-2 select-none flex flex-col gap-1 transition-all duration-200 ease-out opacity-0 scale-95 translate-y-3 hidden';
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
    headerEl.className = 'px-2.5 py-1 text-[10px] font-bold text-white/40 tracking-wider uppercase border-b border-white/5 mb-1 flex justify-between items-center';
    headerEl.innerHTML = `
      <span>最小化的窗口</span>
      <button class="hover:text-white transition-colors cursor-pointer text-[9px] font-extrabold" id="win-restore-all-btn">恢复全部</button>
    `;
    Win.ballPopup.appendChild(headerEl);

    const restoreAllBtn = headerEl.querySelector('#win-restore-all-btn');
    restoreAllBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const items = [...Win.minimizedWindows];
      items.forEach(w => w.restore());
      Win.togglePopup(false);
    });

    Win.minimizedWindows.forEach((winItem) => {
      const row = document.createElement('div');
      row.className = 'w-full group/row flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-white/10 rounded-xl cursor-pointer transition-all duration-150';
      
      const info = document.createElement('div');
      info.className = 'flex items-center gap-2 max-w-[80%] overflow-hidden';
      
      let iconHtml = `
        <svg class="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      `;
      if (winItem.options.url) {
        iconHtml = `
          <img src="https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(winItem.options.url)}" class="w-4 h-4 rounded-md object-contain shrink-0" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><rect x=%223%22 y=%223%22 width=%2218%22 height=%2218%22 rx=%222%22/></svg>'">
        `;
      }

      info.innerHTML = `
        ${iconHtml}
        <span class="text-xs font-semibold text-white/90 truncate font-sans">${winItem.options.title}</span>
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
      btnItemClose.className = 'p-1 rounded-lg text-white/40 hover:text-white hover:bg-rose-500 transition-all flex items-center justify-center shrink-0 cursor-pointer';
      btnItemClose.innerHTML = `
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
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
