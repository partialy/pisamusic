const { contextBridge, ipcRenderer } = require("electron");

type WindowLyricSetting = {
  maxSize: number;
  minSize: number;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  highlightColor: string;
  fontWeight: number;
};

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
      source: "wy" | "kg" | "kw";
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
};

const settingsIpc = {
  getSetting: (key: string) => ipcRenderer.invoke("settings:get", key),
  setSetting: (key: string, value: any, version?: number) =>
    ipcRenderer.invoke("settings:set", { key, value, version }),
  deleteSetting: (key: string) => ipcRenderer.invoke("settings:delete", key),
};

const libraryIpc = {
  addSearchHistory: (payload: { keyword: string; source?: string | null }) =>
    ipcRenderer.invoke("library:search-history:add", payload),
  listSearchHistory: (limit?: number) =>
    ipcRenderer.invoke("library:search-history:list", limit),
  clearSearchHistory: () => ipcRenderer.invoke("library:search-history:clear"),
  deleteSearchHistory: (id: number) =>
    ipcRenderer.invoke("library:search-history:delete", id),
  addPlayHistory: (track: any) =>
    ipcRenderer.invoke("library:play-history:add", track),
  listPlayHistory: (limit?: number) =>
    ipcRenderer.invoke("library:play-history:list", limit),
  getQueueSnapshot: () => ipcRenderer.invoke("library:queue-snapshot:get"),
  saveQueueSnapshot: (snapshot: { currentIndex: number; queue: any[] }) =>
    ipcRenderer.invoke("library:queue-snapshot:save", snapshot),
};

const systemIpc = {
  getSystemBaseUrl: () => ipcRenderer.invoke("system:get-base-url"),
  getBootstrapConfig: () => ipcRenderer.invoke("system:get-bootstrap"),
  getRuntimeEndpoints: (fresh?: boolean) =>
    ipcRenderer.invoke("system:get-runtime-endpoints", fresh),
  getAnnouncements: () => ipcRenderer.invoke("system:get-announcements"),
  submitFeedback: (payload: {
    feedback_type: "bug" | "suggestion" | "account" | "other";
    description: string;
    contact?: string;
    device?: Record<string, unknown>;
  }) => ipcRenderer.invoke("system:submit-feedback", payload),
};

const musicApiIpc = {
  searchMusic: (payload: {
    source: "kg" | "wy" | "kw";
    keywords: string;
    page?: number;
    pageSize?: number;
  }) => ipcRenderer.invoke("music:search", payload),
  resolveMusicUrl: (payload: {
    source: "kg" | "wy" | "kw";
    id: string;
    quality?: string;
    br?: number;
  }) => ipcRenderer.invoke("music:resolve-url", payload),
  resolvePlayableUrl: (track: any) =>
    ipcRenderer.invoke("music:resolve-playable-url", track),
};

const otherIpc = {
  // store
  getStore: (key: string) => ipcRenderer.invoke("store-get", key),
  setStore: (key: string, value: any) =>
    ipcRenderer.invoke("store-set", key, value),
  deleteStore: (key: string) => ipcRenderer.invoke("store-delete", key),
  clearStore: () => ipcRenderer.invoke("store-clear"),
  // 获取url
  getRequestUrl: () => ipcRenderer.invoke("get-request-url"),
  getServerPort: () => ipcRenderer.invoke("get-server-port"),
  // 获取播放url
  getPlayUrl: (song: any) => ipcRenderer.invoke("get-play-url", song),

  getElectronConfig: () => ipcRenderer.invoke("get-electron-config"),
};

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld("electronAPI", {
  ...collectStoreIpc,
  ...windowIpc,
  ...fileIpc,
  ...lyricIpc,
  ...cookieIpc,
  ...systemIpc,
  ...musicApiIpc,
  ...settingsIpc,
  ...libraryIpc,
  ...otherIpc,
});
