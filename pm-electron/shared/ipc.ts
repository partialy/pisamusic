export type Unsubscribe = () => void;

export interface PisaWindowApi {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  hide: () => void;
  reload: () => void;
  openDevTools: () => void;
  onMaximized: (callback: () => void) => Unsubscribe;
  onUnmaximized: (callback: () => void) => Unsubscribe;
}

export interface PisaLegacyApi {
  /**
   * 迁移期保留旧版 yixi 的 electronAPI。
   * 新代码不要继续扩展 legacy，新增能力必须放到明确的 typed namespace 中。
   */
  electron: unknown;
}

export interface PisaApi {
  window: PisaWindowApi;
  legacy: PisaLegacyApi;
}
