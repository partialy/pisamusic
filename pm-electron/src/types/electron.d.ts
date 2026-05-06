declare global {
  type WindowLyricSetting = {
    desktop?: boolean;
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    x?: number;
    y?: number;
    maxSize: number;
    minSize: number;
    fontSize: number;
    fontFamily: string;
    textColor: string;
    highlightColor: string;
    fontWeight: number | string;
    locked?: boolean;
  };

  type ElectronIpc = {
    collectSong: (song: any) => void;
    inCollectSong: (song: any) => void;
    removeSong: (song: any) => void;
    collectedSongs: () => Promise<any[]>;
    collectList: (list: any) => void;
    inCollectList: (list: any) => void;
    removeList: (list: any) => void;
    collectedLists: () => Promise<any[]>;
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    hideWindow: () => void;
    reloadWindow: () => void;
    openDevTools: () => void;
    onHideWindow: (cb: () => void) => () => void;
    onWindowMaximized: (callback: () => void) => () => void;
    onWindowUnmaximized: (callback: () => void) => () => void;
    onLyricWindowStatus: (callback: (status: boolean) => void) => () => void;
    log: (message: any) => void;
    collectError: (error: any) => void;
    getLogs: (date: Date) => Promise<any>;
    readFile: (params: { filename: string; folder: string; dataType?: "object" | "list" }) => Promise<any>;
    writeFile: (params: { filename: string; folder: string; data: string }) => Promise<any>;
    openLyricWindow: () => void;
    changeCurrentSong: (currentSong: any | null) => void;
    isPlaying: (isPlaying: boolean) => void;
    updateTime: (t: number) => void;
    mediaControl: (action: "play" | "pause" | "next" | "previous" | "prev", data?: any) => void;
    setLyrics: (lyric: { type: "krc" | "lrc"; data: string }) => void;
    setLyricStyle: (config: WindowLyricSetting) => void;
    lockLyric: (lock: boolean) => void;
    onMediaControl: (callback: (...args: any[]) => void) => () => void;
    openCookieWindow: (t: "kg" | "wy") => void;
    readCookie: (t: "kg" | "wy") => Promise<any>;
    refreshKGCookie: (data: string) => Promise<any>;
    getStore: (key: string) => Promise<any>;
    setStore: (key: string, value: any) => Promise<any>;
    deleteStore: (key: string) => Promise<any>;
    clearStore: () => Promise<any>;
    getRequestUrl: () => Promise<any>;
    getPlayUrl: (song: any) => Promise<any>;
    getElectronConfig: () => Promise<Record<string, unknown>>;
    getServerPort: () => Promise<{
      backServer: {
        kgServer: string;
        wyServer: string;
        kwServer: string;
        kgProxy: string;
        wyProxy: string;
        kwProxy: string;
      };
    }>;
  };

  interface Window {
    electronAPI: ElectronIpc;
  }
}

export {};
