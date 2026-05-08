export interface PromptOptions {
  title?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  accentColor?: string;
  lang?: 'zh' | 'en';
  onConfirm?: (value: string) => void;
  onCancel?: () => void;
  required?: boolean;
}

const I18N = {
  zh: {
    title: '请输入',
    placeholder: '在此输入内容...',
    confirm: '确定',
    cancel: '取消',
    errorRequired: '此内容不能为空'
  },
  en: {
    title: 'Please Enter',
    placeholder: 'Type here...',
    confirm: 'Confirm',
    cancel: 'Cancel',
    errorRequired: 'This field is required'
  }
};

class PromptManager {
  private backdrop: HTMLDivElement | null = null;
  private modal: HTMLElement | null = null;
  private input: HTMLTextAreaElement | null = null;
  private errorEl: HTMLElement | null = null;
  private options: PromptOptions = {};

  constructor() {}

  show(options: PromptOptions) {
    this.options = options;
    const {
      title,
      placeholder,
      initialValue = '',
      confirmText,
      cancelText,
      accentColor = '#3b82f6',
      lang = 'zh',
      required = false
    } = options;

    const t = I18N[lang];
    const accentTextColor = this.getContrastColor(accentColor);

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 opacity-0 font-sans';
    this.backdrop.innerHTML = `
      <div class="prompt-modal bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 transition-all duration-500 transform scale-95 opacity-0 flex flex-col select-none">
        <div class="mb-6">
          <h3 class="font-display text-xl font-bold text-slate-900 dark:text-slate-100 m-0 tracking-tight">${title || t.title}</h3>
        </div>
        
        <div class="mb-6 relative">
          <textarea 
            class="prompt-input w-full min-h-[120px] p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all resize-none font-sans text-base"
            placeholder="${placeholder || t.placeholder}"
            style="--tw-ring-color: ${accentColor}40; focus:border-color: ${accentColor}"
          >${initialValue}</textarea>
          <div class="prompt-error hidden mt-2 ml-2 text-xs font-medium text-rose-500 animate-in fade-in slide-in-from-top-1">
            ${t.errorRequired}
          </div>
        </div>

        <div class="flex gap-3">
          <button class="prompt-btn-cancel flex-1 py-3.5 rounded-[18px] border-none font-display text-sm font-bold cursor-pointer transition-all duration-300 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:translate-y-[-2px] hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100">${cancelText || t.cancel}</button>
          <button class="prompt-btn-confirm flex-1 py-3.5 rounded-[18px] border-none font-display text-sm font-bold cursor-pointer transition-all duration-300 shadow-lg hover:translate-y-[-2px] hover:opacity-90" style="background-color: ${accentColor}; color: ${accentTextColor}">
            ${confirmText || t.confirm}
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(this.backdrop);

    this.modal = this.backdrop.querySelector('.prompt-modal') as HTMLElement;
    this.input = this.modal.querySelector('.prompt-input') as HTMLTextAreaElement;
    this.errorEl = this.modal.querySelector('.prompt-error') as HTMLElement;

    // Focus input
    setTimeout(() => this.input?.focus(), 100);

    // Event Listeners
    this.modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.closest('.prompt-btn-confirm')) {
        const value = this.input?.value.trim() || '';
        if (required && !value) {
          this.showError();
          return;
        }
        this.close();
        if (this.options.onConfirm) this.options.onConfirm(value);
      }

      if (target.closest('.prompt-btn-cancel')) {
        this.close();
        if (this.options.onCancel) this.options.onCancel();
      }
    });

    this.input.addEventListener('input', () => {
      if (this.errorEl && !this.errorEl.classList.contains('hidden')) {
        this.errorEl.classList.add('hidden');
        this.input?.classList.remove('border-rose-500', 'ring-rose-500/20');
      }
    });

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
        if (this.options.onCancel) this.options.onCancel();
      }
    });

    requestAnimationFrame(() => {
      if (this.backdrop && this.modal) {
        this.backdrop.classList.remove('opacity-0');
        this.modal.classList.remove('scale-95', 'opacity-0');
        this.modal.classList.add('scale-100', 'opacity-100');
      }
    });

    return this.backdrop;
  }

  private showError() {
    if (this.errorEl && this.input) {
      this.errorEl.classList.remove('hidden');
      this.input.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/20');
      this.input.focus();
    }
  }

  private close() {
    if (!this.backdrop || !this.modal) return;
    const el = this.backdrop;
    const modal = this.modal;
    modal.classList.add('scale-95', 'opacity-0');
    el.classList.add('opacity-0');
    setTimeout(() => {
      if (el.parentNode === document.body) {
        document.body.removeChild(el);
      }
    }, 300);
    this.backdrop = null;
    this.modal = null;
    this.input = null;
    this.errorEl = null;
  }

  private getContrastColor(hex: string): string {
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split('').map(s => s + s).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#0f172a' : '#ffffff';
  }
}

export const prompt = new PromptManager();
