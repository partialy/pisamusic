const { contextBridge, ipcRenderer } = require("electron");

type WindowLyricSetting = {
  width: number;
  height: number;
  overlayTaskbar: boolean;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  highlightColor: string;
  fontWeight: number;
};

type ShortcutAction =
  | "prev"
  | "next"
  | "play-toggle"
  | "lyric-lock"
  | "lyric-unlock"
  | "favorite-song";

type ShortcutSetting = {
  enabled: boolean;
  global: boolean;
  bindings: Record<ShortcutAction, string>;
};

type Unsubscribe = () => void;

function on(channel: string, callback: (...args: any[]) => void): Unsubscribe {
  const listener = (_event: unknown, ...args: any[]) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

function cloneIpcPayload<T>(payload: T): T {
  if (payload === undefined || payload === null) return payload;
  return JSON.parse(JSON.stringify(payload));
}

const windowIpc = {
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize-toggle"),
  closeWindow: () => ipcRenderer.send("window:close"),
  hideWindow: () => ipcRenderer.send("window:hide"),
  reloadWindow: () => ipcRenderer.send("window:reload"),
  openDevTools: () => ipcRenderer.send("window:dev-tools"),
  openUrl: (payload: { url: string; mode?: "window" | "external" }) =>
    ipcRenderer.invoke("window:open-url", cloneIpcPayload(payload)),
  onHideWindow: (cb: () => void) => on("window:hide", cb),
  onWindowMaximized: (callback: () => void) => on("window:maximized", callback),
  onWindowUnmaximized: (callback: () => void) => on("window:unmaximized", callback),
};

const startupIpc = {
  notifyStartupReady: () => ipcRenderer.send("startup:renderer-ready"),
};

const logIpc = {
  log: (message: unknown) => ipcRenderer.invoke("app:log", message),
  reportError: (error: unknown, context?: Record<string, unknown>) =>
    ipcRenderer.invoke("app:log-error", normalizeError(error, context)),
  getLogs: (date?: Date | string) => ipcRenderer.invoke("logs:list", date),
  getRecentLogs: (limit?: number) => ipcRenderer.invoke("logs:recent", limit),
  exportRecentLog: () => ipcRenderer.invoke("logs:export"),
  openLogsDir: () => ipcRenderer.invoke("logs:open-dir"),
};

const desktopLyricIpc = {
  openLyricWindow: () => ipcRenderer.invoke("desktop-lyric:open"),
  closeLyricWindow: () => ipcRenderer.invoke("desktop-lyric:close"),
  toggleLyricWindow: () => ipcRenderer.invoke("desktop-lyric:toggle"),
  changeCurrentSong: (currentSong: any | null) =>
    ipcRenderer.send("player:set-current-song", cloneIpcPayload(currentSong)),
  isPlaying: (isPlaying: boolean) => ipcRenderer.send("player:set-playing", isPlaying),
  updateTime: (time: number) => ipcRenderer.send("player:update-time", time),
  mediaControl: (action: "play" | "pause" | "next" | "prev" | "previous") =>
    ipcRenderer.send("player:set-playing", action === "play"),
  setLyrics: (lyric: { type: "krc" | "lrc"; data: string }) =>
    ipcRenderer.send("desktop-lyric:set-lyrics", cloneIpcPayload(lyric)),
  setLyricStyle: (config: WindowLyricSetting) =>
    ipcRenderer.send("desktop-lyric:set-style", cloneIpcPayload(config)),
  lockLyric: (lock: boolean) => ipcRenderer.send("desktop-lyric:set-locked", lock),
  onLyricWindowStatus: (callback: (status: boolean) => void) =>
    on("desktop-lyric:status", callback),
  onLyricLockedStatus: (callback: (locked: boolean) => void) =>
    on("desktop-lyric:locked-status", callback),
  onBoundsChanged: (callback: (bounds: { width: number; height: number }) => void) =>
    on("desktop-lyric:bounds-changed", callback),
  onMediaControl: (
    callback: (action: "play" | "pause" | "next" | "prev", ...args: any[]) => void
  ) => on("media-control", callback),
};

const settingsIpc = {
  getSetting: (key: string) => ipcRenderer.invoke("settings:get", key),
  setSetting: (key: string, value: any, version?: number) =>
    ipcRenderer.invoke("settings:set", { key, value: cloneIpcPayload(value), version }),
  deleteSetting: (key: string) => ipcRenderer.invoke("settings:delete", key),
  selectDirectory: (title?: string) => ipcRenderer.invoke("dialog:select-directory", title),
  selectPlaylistCover: () => ipcRenderer.invoke("dialog:select-playlist-cover"),
};

const shortcutIpc = {
  applyShortcutSetting: (setting: ShortcutSetting) =>
    ipcRenderer.invoke("shortcut:apply", cloneIpcPayload(setting)),
  onShortcutTrigger: (callback: (action: ShortcutAction) => void) =>
    on("shortcut:trigger", callback),
};

const libraryIpc = {
  addSearchHistory: (payload: { keyword: string; source?: string | null }) =>
    ipcRenderer.invoke("library:search-history:add", cloneIpcPayload(payload)),
  listSearchHistory: (limit?: number) =>
    ipcRenderer.invoke("library:search-history:list", limit),
  clearSearchHistory: () => ipcRenderer.invoke("library:search-history:clear"),
  deleteSearchHistory: (id: number) =>
    ipcRenderer.invoke("library:search-history:delete", id),
  addPlayHistory: (track: any) =>
    ipcRenderer.invoke("library:play-history:add", cloneIpcPayload(track)),
  listPlayHistory: (limit?: number) =>
    ipcRenderer.invoke("library:play-history:list", limit),
  getQueueSnapshot: () => ipcRenderer.invoke("library:queue-snapshot:get"),
  saveQueueSnapshot: (snapshot: { currentIndex: number; queue: any[] }) =>
    ipcRenderer.invoke("library:queue-snapshot:save", cloneIpcPayload(snapshot)),
  listFavoriteSongs: () => ipcRenderer.invoke("library:favorites:songs:list"),
  addFavoriteSong: (track: any) =>
    ipcRenderer.invoke("library:favorites:songs:add", cloneIpcPayload(track)),
  removeFavoriteSong: (payload: { source: string; id: string }) =>
    ipcRenderer.invoke("library:favorites:songs:remove", cloneIpcPayload(payload)),
  toggleFavoriteSong: (track: any) =>
    ipcRenderer.invoke("library:favorites:songs:toggle", cloneIpcPayload(track)),
  containsFavoriteSong: (payload: { source: string; id: string }) =>
    ipcRenderer.invoke("library:favorites:songs:contains", cloneIpcPayload(payload)),
  listFavoritePlaylists: () =>
    ipcRenderer.invoke("library:favorites:playlists:list"),
  addFavoritePlaylist: (playlist: any) =>
    ipcRenderer.invoke("library:favorites:playlists:add", cloneIpcPayload(playlist)),
  removeFavoritePlaylist: (payload: { source: string; id: string }) =>
    ipcRenderer.invoke("library:favorites:playlists:remove", cloneIpcPayload(payload)),
  toggleFavoritePlaylist: (playlist: any) =>
    ipcRenderer.invoke("library:favorites:playlists:toggle", cloneIpcPayload(playlist)),
  containsFavoritePlaylist: (payload: { source: string; id: string }) =>
    ipcRenderer.invoke("library:favorites:playlists:contains", cloneIpcPayload(payload)),
  onFavoritesChanged: (callback: () => void) => on("favorites:changed", callback),
  listUserPlaylists: (payload?: { source?: "kg" | "wy" | "kw" | "qq" | "local" | "all" }) =>
    ipcRenderer.invoke("library:playlists:list", cloneIpcPayload(payload ?? {})),
  createUserPlaylist: (playlist: any) =>
    ipcRenderer.invoke("library:playlists:create", cloneIpcPayload(playlist)),
  upsertUserPlaylist: (playlist: any) =>
    ipcRenderer.invoke("library:playlists:upsert", cloneIpcPayload(playlist)),
  replaceUserPlaylists: (payload: { source: "kg" | "wy" | "kw" | "qq"; playlists: any[] }) =>
    ipcRenderer.invoke("library:playlists:replace-source", cloneIpcPayload(payload)),
  listUserPlaylistTracks: (payload: { playlistId: string }) =>
    ipcRenderer.invoke("library:playlists:tracks:list", cloneIpcPayload(payload)),
  addUserPlaylistTrack: (payload: { playlistId: string; track: any }) =>
    ipcRenderer.invoke("library:playlists:tracks:add", cloneIpcPayload(payload)),
  listUserCloudSongs: (payload?: { cloudSource?: string | "all" }) =>
    ipcRenderer.invoke("library:cloud:songs:list", cloneIpcPayload(payload ?? {})),
  replaceUserCloudSongs: (payload: { cloudSource: string; songs: any[] }) =>
    ipcRenderer.invoke("library:cloud:songs:replace", cloneIpcPayload(payload)),
  listLocalSongs: () => ipcRenderer.invoke("library:local:songs:list"),
  getLocalLibraryScanStatus: () => ipcRenderer.invoke("library:local:scan-status"),
  refreshLocalLibrary: () => ipcRenderer.invoke("library:local:refresh"),
  getLocalSongCover: (filePath: string) => ipcRenderer.invoke("library:local:cover", filePath),
  removeLocalSongFromList: (payload: { filePath?: string; deleteFile?: boolean }) =>
    ipcRenderer.invoke("library:local:songs:remove", cloneIpcPayload(payload)),
  onLocalLibraryScanStarted: (callback: (status: any) => void) =>
    on("local-library:scan-started", callback),
  onLocalLibraryScanFinished: (callback: (status: any) => void) =>
    on("local-library:scan-finished", callback),
  onLocalLibraryScanFailed: (callback: (status: any) => void) =>
    on("local-library:scan-failed", callback),
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
  }) => ipcRenderer.invoke("system:submit-feedback", cloneIpcPayload(payload)),
};

const musicApiIpc = {
  searchMusic: (payload: {
    source: "kg" | "wy" | "kw";
    keywords: string;
    page?: number;
    pageSize?: number;
  }) => ipcRenderer.invoke("music:search", cloneIpcPayload(payload)),
  searchSuggest: (payload: { source?: "wy"; keywords: string }) =>
    ipcRenderer.invoke("music:search-suggest", cloneIpcPayload(payload)),
  searchPlaylists: (payload: {
    source: "kg" | "wy";
    keywords: string;
    page?: number;
    pageSize?: number;
  }) => ipcRenderer.invoke("music:search-playlists", cloneIpcPayload(payload)),
  getKgPlaylistTags: () => ipcRenderer.invoke("music:kg-playlist-tags"),
  getPlaylistTags: (payload: { source: "kg" | "wy" }) =>
    ipcRenderer.invoke("music:playlist-tags", cloneIpcPayload(payload)),
  getTopPlaylists: (payload: {
    source: "kg" | "wy";
    categoryId?: string | number;
    cat?: string;
    order?: "hot" | "new";
    page?: number;
    pageSize?: number;
  }) => ipcRenderer.invoke("music:top-playlists", cloneIpcPayload(payload)),
  getTopSongs: (payload: { source: "kg" }) =>
    ipcRenderer.invoke("music:top-songs", cloneIpcPayload(payload)),
  getWyPersonalizedPlaylists: (payload?: { limit?: number }) =>
    ipcRenderer.invoke("music:wy-personalized-playlists", cloneIpcPayload(payload ?? {})),
  getWyPersonalizedNewSongs: (payload?: { limit?: number }) =>
    ipcRenderer.invoke("music:wy-personalized-new-songs", cloneIpcPayload(payload ?? {})),
  getKgDailyRecommend: (platform?: string) =>
    ipcRenderer.invoke("music:kg-daily-recommend", platform),
  getHomeRecommendations: () =>
    ipcRenderer.invoke("music:home-recommendations"),
  getPlaylistDetail: (payload: { source: "kg" | "wy"; id: string }) =>
    ipcRenderer.invoke("music:playlist-detail", cloneIpcPayload(payload)),
  getPlaylistTracks: (payload: {
    source: "kg" | "wy";
    id: string;
    offset?: number;
    page?: number;
    pageSize?: number;
  }) => ipcRenderer.invoke("music:playlist-tracks", cloneIpcPayload(payload)),
  getDynamicCover: (payload: { source: "wy"; id: string | number }) =>
    ipcRenderer.invoke("music:dynamic-cover", cloneIpcPayload(payload)),
  resolveMusicUrl: (payload: {
    source: "kg" | "wy" | "kw";
    id: string;
    qualityKey?: string;
    quality?: string;
    br?: number;
    level?: string;
  }) => ipcRenderer.invoke("music:resolve-url", cloneIpcPayload(payload)),
  resolvePlayableUrl: (track: any) =>
    ipcRenderer.invoke("music:resolve-playable-url", cloneIpcPayload(track)),
  fetchLyrics: (payload: {
    source: "kg" | "wy" | "kw";
    id?: string;
    hash?: string;
  }) => ipcRenderer.invoke("music:fetch-lyrics", cloneIpcPayload(payload)),
};

const cookieApiIpc = {
  getUserCookie: (source: "kg" | "wy") => ipcRenderer.invoke("cookie:get-cookie", source),
  clearUserCookie: (source: "kg" | "wy") => ipcRenderer.invoke("cookie:clear-cookie", source),
  kgSendCaptcha: (payload: { mobile: string }) =>
    ipcRenderer.invoke("cookie:kg-send-captcha", cloneIpcPayload(payload)),
  kgLoginWithCode: (payload: { mobile: string; code: string }) =>
    ipcRenderer.invoke("cookie:kg-login-with-code", cloneIpcPayload(payload)),
  kgStartQrLogin: () => ipcRenderer.invoke("cookie:kg-start-qr-login"),
  kgCheckQrLogin: (payload: { loginId: string }) =>
    ipcRenderer.invoke("cookie:kg-check-qr-login", cloneIpcPayload(payload)),
  wyOpenLoginWindow: (payload: { mode: "pc" | "mobile" }) =>
    ipcRenderer.invoke("cookie:wy-open-login-window", cloneIpcPayload(payload)),
  getCookieAccountProfile: (payload: { source: "kg" | "wy" }) =>
    ipcRenderer.invoke("cookie:account-profile", cloneIpcPayload(payload)),
  refreshCookieAccount: (payload: { source: "kg" | "wy" }) =>
    ipcRenderer.invoke("cookie:refresh-account", cloneIpcPayload(payload)),
  getCookieDebugUserInfo: (source: "kg" | "wy") =>
    ipcRenderer.invoke("cookie:debug-user-info", source),
  exportCookieFiles: () => ipcRenderer.invoke("cookie:export-files"),
  getCookieUserPlaylists: (payload: {
    source: "kg" | "wy";
    page?: number;
    pageSize?: number;
    uid?: string | number;
    offset?: number;
  }) => ipcRenderer.invoke("cookie:user-playlists", cloneIpcPayload(payload)),
  getWyCloudSongs: (payload: {
    page?: number;
    pageSize?: number;
    offset?: number;
  }) => ipcRenderer.invoke("cookie:wy-cloud-songs", cloneIpcPayload(payload)),
};

const downloadApiIpc = {
  startDownloadTask: (payload: { song: any; qualityKey?: string; directory: string }) =>
    ipcRenderer.invoke("download:start", cloneIpcPayload(payload)),
  listDownloadTasks: () => ipcRenderer.invoke("download:tasks"),
  listDownloadRecords: () => ipcRenderer.invoke("download:records"),
  listDownloadedSongs: () => ipcRenderer.invoke("download:songs"),
};

function normalizeError(error: unknown, context?: Record<string, unknown>) {
  const fallback = String(error);
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
      time: new Date().toISOString(),
    };
  }
  if (typeof error === "object" && error !== null) {
    const value = error as Record<string, unknown>;
    return {
      name: String(value.name || "Error"),
      message: String(value.message || fallback),
      stack: String(value.stack || ""),
      context,
      time: new Date().toISOString(),
    };
  }
  return {
    name: "Error",
    message: fallback,
    stack: "",
    context,
    time: new Date().toISOString(),
  };
}

const utilsIpc = {
  getColorFromUrl: (url: string) => ipcRenderer.invoke("utils:get-color-from-url", url),
};

const debugIpc = {
  isDevelopmentRuntime: () => ipcRenderer.invoke("debug:is-development-runtime"),
  listNetworkErrors: (payload?: { page?: number; pageSize?: number }) =>
    ipcRenderer.invoke("debug:network-errors:list", cloneIpcPayload(payload)),
  getNetworkErrorDetail: (id: number) => ipcRenderer.invoke("debug:network-errors:detail", id),
  exportNetworkErrors: (limit: 10 | 100) =>
    ipcRenderer.invoke("debug:network-errors:export", limit),
};

contextBridge.exposeInMainWorld("electronAPI", {
  ...windowIpc,
  ...startupIpc,
  ...logIpc,
  ...desktopLyricIpc,
  ...systemIpc,
  ...musicApiIpc,
  ...cookieApiIpc,
  ...downloadApiIpc,
  ...settingsIpc,
  ...shortcutIpc,
  ...libraryIpc,
  ...utilsIpc,
  ...debugIpc,
});
