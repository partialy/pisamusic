export type AlertType = 'success' | 'error' | 'info' | 'warning';

export interface AlertOptions {
  title?: string;
  content: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  showClose?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

class AlertManager {
  constructor() {
    // No styles to inject, using Tailwind
  }

  show(options: AlertOptions) {
    const {
      title = 'Notification',
      content,
      type = 'info',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      showCancel = false,
      showClose = true,
      onConfirm,
      onCancel,
      compact = false
    } = options;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 opacity-0 font-sans';
    
    const card = document.createElement('div');
    card.className = `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-full transition-all duration-300 transform scale-95 opacity-0 ${compact ? 'max-w-sm' : 'max-w-md'}`;

    // Icon based on type
    const iconColors = {
      success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      error: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
      info: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
    };

    const iconPaths = {
      success: 'm9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
      error: 'm15 9-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
      info: 'M12 16v-4m0-4h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10Z',
      warning: 'M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 17c-.77 1.333.192 3 1.732 3Z'
    };

    const headerHtml = `
      <div class="flex items-start justify-between p-6 pb-2">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${iconColors[type]}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="${iconPaths[type]}"/>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">${title}</h3>
        </div>
        ${showClose ? `
          <button class="alert-close-btn p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        ` : ''}
      </div>
    `;

    const bodyHtml = `
      <div class="px-6 py-4">
        <p class="text-slate-600 dark:text-slate-400 leading-relaxed">${content}</p>
      </div>
    `;

    const footerHtml = `
      <div class="flex items-center justify-end gap-3 p-6 pt-2">
        ${showCancel ? `
          <button class="alert-cancel-btn px-5 py-2.5 rounded-2xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            ${cancelText}
          </button>
        ` : ''}
        <button class="alert-confirm-btn px-6 py-2.5 rounded-2xl text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer shadow-lg shadow-slate-200 dark:shadow-none">
          ${confirmText}
        </button>
      </div>
    `;

    card.innerHTML = headerHtml + bodyHtml + footerHtml;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove('opacity-100');
      card.classList.remove('scale-100', 'opacity-100');
      card.classList.add('scale-95', 'opacity-0');
      setTimeout(() => {
        if (overlay.parentNode) document.body.removeChild(overlay);
      }, 300);
    };

    // Event listeners
    if (showClose) {
      overlay.querySelector('.alert-close-btn')?.addEventListener('click', () => {
        close();
        if (onCancel) onCancel();
      });
    }

    if (showCancel) {
      overlay.querySelector('.alert-cancel-btn')?.addEventListener('click', () => {
        close();
        if (onCancel) onCancel();
      });
    }

    overlay.querySelector('.alert-confirm-btn')?.addEventListener('click', () => {
      close();
      if (onConfirm) onConfirm();
    });

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('opacity-100');
      card.classList.remove('scale-95', 'opacity-0');
      card.classList.add('scale-100', 'opacity-100');
    });

    return { close };
  }

  success(content: string, title?: string) {
    return this.show({ content, title: title || 'Success', type: 'success' });
  }

  error(content: string, title?: string) {
    return this.show({ content, title: title || 'Error', type: 'error' });
  }

  info(content: string, title?: string) {
    return this.show({ content, title: title || 'Information', type: 'info' });
  }

  warning(content: string, title?: string) {
    return this.show({ content, title: title || 'Warning', type: 'warning' });
  }
}

export const alert = new AlertManager();
