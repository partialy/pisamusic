const collectStoreIpc = {
  collectSong: (song: any) => ipcRenderer.send("collect-song", song),
  inCollectSong: (song: any) => ipcRenderer.send("incollect-song", song),
  removeSong: (song: any) => ipcRenderer.send("remove-song", song),
  collectedSongs: (): any[] => ipcRenderer.invoke("collected-songs"),

  collectList: (list: any) => ipcRenderer.send("collect-list", list),
  inCollectList: (list: any) => ipcRenderer.send("incollect-list", list),
  removeList: (list: any) => ipcRenderer.send("remove-list", list),
  collectedLists: (): any[] => ipcRenderer.invoke("collected-lists"),
};

const windowIpc = {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  maximizeWindow: () => ipcRenderer.send("maximize-window"),
  closeWindow: () => ipcRenderer.send("close-window"),
  hideWindow: () => ipcRenderer.send("hide-window"),
  // reloadWindow
  reloadWindow: () => ipcRenderer.send("window-reload"),
  // openDevTools
  openDevTools: () => ipcRenderer.send("dev-tools"),
  onHideWindow: (cb: () => void) => {
    ipcRenderer.on("hide-window", () => cb());
    return () => {
      ipcRenderer.removeAllListeners("hide-window");
    };
  },
  // 窗口状态监听
  onWindowMaximized: (callback: () => void) => {
    ipcRenderer.on("window-maximized", () => callback());
    return () => {
      ipcRenderer.removeAllListeners("window-maximized");
    };
  },
  onWindowUnmaximized: (callback: () => void) => {
    ipcRenderer.on("window-unmaximized", () => callback());
    return () => {
      ipcRenderer.removeAllListeners("window-unmaximized");
    };
  },
  // 桌面歌词控制
  onLyricWindowStatus: (callback: (status: boolean) => void) => {
    ipcRenderer.on("lyric-window-status", (_: any, status: boolean) => {
      callback(status);
    });
    return () => {
      ipcRenderer.removeAllListeners("lyric-window-status");
    };
  },
};

const fileIpc = {
  // log
  log: (message: any) => ipcRenderer.send("log", message),

  collectError: (error: any) => ipcRenderer.send("collect-error", error),

  // 读取日志
  getLogs: (date: Date) => ipcRenderer.invoke("get-logs", date),

  readFile: (params: { filename: string; folder: string }) =>
    ipcRenderer.invoke("readFile", params),

  writeFile: (params: { filename: string; folder: string; data: string }) =>
    ipcRenderer.invoke("writeFile", params),
};

const lyricIpc = {
  openLyricWindow: () => ipcRenderer.send("open-lyric-window"),
  changeCurrentSong: (
    currentSong: {
      id: string;
      name: string;
      singer: string;
      cover: string;
      source: "wy" | "kg" | "kw" | "qq";
      duration: number;
      coverSize?: {
        s: string;
        m: string;
        l: string;
        xl: string;
      };
    } | null
  ) => ipcRenderer.send("change-current-song", currentSong),
  isPlaying: (isPlaying: boolean) => ipcRenderer.send("is-playing", isPlaying),
  updateTime: (t: number) => ipcRenderer.send("update-time", t),
  mediaControl: (action: "play" | "pause" | "next" | "previous", data?: any) =>
    ipcRenderer.send("media-control", action, data),
  setLyrics: (lyric: { type: "krc" | "lrc"; data: string }) =>
    ipcRenderer.send("set-lyrics", lyric),
  setLyricStyle: (config: WindowLyricSetting) =>
    ipcRenderer.send("set-lyric-style", config),
  lockLyric: (lock: boolean) => ipcRenderer.send("lock-lyric", lock),
  onMediaControl: (callback: (...args: any[]) => void) => {
    // 注意：ipcRenderer.on 用于持续监听事件，ipcRenderer.once 仅监听一次
    ipcRenderer.on("media-control", (_: any, ...args: any[]) => {
      // 将主进程传递的参数透传给渲染进程的回调函数
      callback(...args);
    });
    return () => {
      ipcRenderer.removeAllListeners("media-control");
    };
  },
};

const cookieIpc = {
  openCookieWindow: (t: "kg" | "wy") => ipcRenderer.send("open-kg-window", t),
  readCookie: (t: "kg" | "wy") => ipcRenderer.invoke("read-cookie", t),
  refreshKGCookie: (data: string) =>
    ipcRenderer.invoke("refresh-kg-cookie", data),
}

const otherIpc = {
  // store
  getStore: (key: string) => ipcRenderer.invoke("store-get", key),
  setStore: (key: string, value: any) =>
    ipcRenderer.invoke("store-set", key, value),
  deleteStore: (key: string) => ipcRenderer.invoke("store-delete", key),
  clearStore: () => ipcRenderer.invoke("store-clear"),
  // 获取url
  getRequestUrl: () => ipcRenderer.invoke("get-request-url"),
  // 获取播放url
  getPlayUrl: (song: any) => ipcRenderer.invoke("get-play-url", song),

  getElectronConfig: () => ipcRenderer.invoke("get-electron-config"),
};

type WindowIpc = typeof windowIpc;
type CollectSoreIpc = typeof collectStoreIpc;
type FileIpc = typeof fileIpc;
type LyricIpc = typeof lyricIpc;
type CookieIpc = typeof cookieIpc;
type OtherIpc = typeof otherIpc;
declare type ElectronIpc = WindowIpc & CollectSoreIpc & FileIpc & LyricIpc & CookieIpc & OtherIpc;

declare global {
  interface Window {
    /**
     * Electron 提供的 IPC 通信接口
     */
    electronAPI: ElectronIpc;
  }
}

declare type WindowLyricSetting = {
    maxSize: number;
    minSize: number;
    fontSize: number;
    fontFamily: string;
    textColor: string;
    highlightColor: string;
    fontWeight: number;
  }
