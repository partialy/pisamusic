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
  restartApp: () => ipcRenderer.send("window:restart-app"),
  openDevTools: () => ipcRenderer.send("window:dev-tools"),
  openUrl: (payload: { url: string; mode?: "window" | "external" }) =>
    ipcRenderer.invoke("window:open-url", cloneIpcPayload(payload)),
  openAnnouncementAction: (action: {
    type: "url" | "protocol";
    url?: string;
    value?: string;
    openMode?: "browser" | "app";
  }) => ipcRenderer.invoke("window:open-announcement-action", cloneIpcPayload(action)),
  onHideWindow: (cb: () => void) => on("window:hide", cb),
  onWindowMaximized: (callback: () => void) => on("window:maximized", callback),
  onWindowUnmaximized: (callback: () => void) => on("window:unmaximized", callback),
  onRouteSettings: (callback: () => void) => on("route:settings", callback),
};

const lowPowerIpc = {
  getLowPowerState: () => ipcRenderer.invoke("low-power:get-state"),
  setAutoLowPower: (enabled: boolean) => ipcRenderer.invoke("low-power:set-auto", Boolean(enabled)),
  enterLowPowerMode: (options?: { hideWindow?: boolean }) =>
    ipcRenderer.invoke("low-power:enter", cloneIpcPayload(options ?? {})),
  exitLowPowerMode: (options?: { showWindow?: boolean }) =>
    ipcRenderer.invoke("low-power:exit", cloneIpcPayload(options ?? {})),
  onLowPowerStateChanged: (callback: (state: import("../src/types/lowPower").LowPowerState) => void) =>
    on("low-power:state-changed", callback),
};

const startupIpc = {
  notifyStartupReady: () => ipcRenderer.send("startup:renderer-ready"),
};

const updaterIpc = {
  getUpdaterState: () => ipcRenderer.invoke("updater:get-state"),
  checkForUpdates: (options?: { manual?: boolean }) =>
    ipcRenderer.invoke("updater:check", cloneIpcPayload(options ?? {})),
  simulateCheckForUpdates: () => ipcRenderer.invoke("updater:simulate-check"),
  downloadUpdate: () => ipcRenderer.invoke("updater:download"),
  quitAndInstallUpdate: () => ipcRenderer.invoke("updater:quit-and-install"),
  onUpdaterState: (callback: (state: any) => void) => on("updater:state", callback),
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

import type {
  DesktopLyricClockSync,
  DesktopLyricPayload,
  DesktopLyricSettingPatch,
  DesktopLyricSettingV2,
} from "../src/types/desktopLyric";

const desktopLyricIpc = {
  openLyricWindow: () => ipcRenderer.invoke("desktop-lyric:open"),
  closeLyricWindow: () => ipcRenderer.invoke("desktop-lyric:close"),
  toggleLyricWindow: () => ipcRenderer.invoke("desktop-lyric:toggle"),
  getDesktopLyricSnapshot: () => ipcRenderer.invoke("desktop-lyric:get-snapshot"),
  syncDesktopLyricClock: (clock: DesktopLyricClockSync) =>
    ipcRenderer.send("desktop-lyric:sync-clock", cloneIpcPayload(clock)),
  setDesktopLyricPayload: (payload: DesktopLyricPayload) =>
    ipcRenderer.send("desktop-lyric:set-lyrics", cloneIpcPayload(payload)),
  patchDesktopLyricSetting: (patch: DesktopLyricSettingPatch) =>
    ipcRenderer.send("desktop-lyric:set-style", cloneIpcPayload(patch)),
  onDesktopLyricSettingChanged: (callback: (setting: DesktopLyricSettingV2) => void) =>
    on("desktop-lyric:setting-changed", callback),
  setDesktopLyricLocked: (locked: boolean) =>
    ipcRenderer.send("desktop-lyric:set-locked", locked),
  changeCurrentSong: (currentSong: any | null) =>
    ipcRenderer.send("player:set-current-song", cloneIpcPayload(currentSong)),
  releaseLocalPlayback: (song: { id: string; source: string; url?: string }) =>
    ipcRenderer.send("player:release-local-file", cloneIpcPayload(song)),
  commitLocalPlayback: (song: { id: string; source: string; url?: string }) =>
    ipcRenderer.invoke("player:commit-local-file", cloneIpcPayload(song)),
  isPlaying: (isPlaying: boolean) => ipcRenderer.send("player:set-playing", isPlaying),
  updateTime: (time: number) => ipcRenderer.send("player:update-time", time),
  setLyrics: (lyric: { type: "krc" | "lrc"; data: string }) =>
    ipcRenderer.send("desktop-lyric:set-lyrics", cloneIpcPayload(lyric)),
  setLyricStyle: (config: WindowLyricSetting | Partial<DesktopLyricSettingV2>) =>
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

// 本机歌单封面：只传受管资源 ID 和公开表单，不传磁盘路径或凭据。
const playlistCoverIpc = {
  selectManagedPlaylistCover: () => ipcRenderer.invoke("playlist-cover:select"),
  savePlaylistEdit: (input: import("../src/types/playlistCover").PlaylistEditInput) => ipcRenderer.invoke("playlist-cover:save-edit", cloneIpcPayload(input)),
  retryPlaylistCover: (input: { playlistId: string; identityRevision: number }) => ipcRenderer.invoke("playlist-cover:retry", cloneIpcPayload(input)),
};

const settingsIpc = {
  getSetting: (key: string) => ipcRenderer.invoke("settings:get", key),
  setSetting: (key: string, value: any, version?: number) =>
    ipcRenderer.invoke("settings:set", { key, value: cloneIpcPayload(value), version }),
  deleteSetting: (key: string) => ipcRenderer.invoke("settings:delete", key),
  selectDirectory: (title?: string) => ipcRenderer.invoke("dialog:select-directory", title),
  selectPlaylistCover: () => ipcRenderer.invoke("dialog:select-playlist-cover"),
  selectBackgroundImage: () => ipcRenderer.invoke("dialog:select-background-image"),
  selectBackgroundImages: () => ipcRenderer.invoke("dialog:select-background-images"),
  deleteBackgroundImage: (fileUrl: string) => ipcRenderer.invoke("dialog:delete-background-image", fileUrl),
};

const mediaCacheIpc = {
  getMediaCacheStatus: () => ipcRenderer.invoke("media-cache:status"),
  refreshMediaCachePolicy: () => ipcRenderer.invoke("media-cache:refresh-policy"),
  clearMediaCache: () => ipcRenderer.invoke("media-cache:clear"),
};

const shortcutIpc = {
  applyShortcutSetting: (setting: ShortcutSetting) =>
    ipcRenderer.invoke("shortcut:apply", cloneIpcPayload(setting)),
  onShortcutTrigger: (callback: (action: ShortcutAction) => void) =>
    on("shortcut:trigger", callback),
};

let libraryRevision: number | undefined;
ipcRenderer.on("account:identity-changed", (_event: unknown, revision: number) => { libraryRevision = revision; });
function invokeLibrary(channel: string, payload?: unknown) {
  return ipcRenderer.invoke(channel, cloneIpcPayload(payload), libraryRevision);
}
const libraryIpc = {
  getLibraryIdentity: () => ipcRenderer.invoke("library:identity").then((identity: { identityRevision: number }) => { libraryRevision = Math.max(libraryRevision ?? -1, identity.identityRevision); return identity; }),
  onAccountIdentityChanged: (callback: (revision: number) => void) => on("account:identity-changed", callback),
  getUnassociatedImportPrompt: () => ipcRenderer.invoke("library:unassociated:prompt"),
  previewUnassociatedLibrary: () => ipcRenderer.invoke("library:unassociated:preview"),
  importUnassociatedLibrary: (confirmationId: string) => ipcRenderer.invoke("library:unassociated:import", confirmationId),
  resolveLocalTracks: (tracks: any[]) => ipcRenderer.invoke("library:local:resolve-tracks", cloneIpcPayload(tracks)),
  createUserPlaylistWithTracks: (payload: any) => invokeLibrary("library:playlists:create-with-tracks", payload),
  updateUserPlaylist: (payload: any) => invokeLibrary("library:playlists:update", payload),
  removeUserPlaylist: (payload: { source: string; id: string }) => invokeLibrary("library:playlists:remove", payload),
  bulkAddUserPlaylistTracks: (payload: any) => invokeLibrary("library:playlists:tracks:bulk-add", payload),
  bulkRemoveUserPlaylistTracks: (payload: any) => invokeLibrary("library:playlists:tracks:bulk-remove", payload),
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
  listFavoriteSongs: () => invokeLibrary("library:favorites:songs:list"),
  addFavoriteSong: (track: any) =>
    invokeLibrary("library:favorites:songs:add", cloneIpcPayload(track)),
  ensureFavoriteSong: (track: any) => invokeLibrary("library:favorites:songs:ensure", cloneIpcPayload(track)),
  removeFavoriteSong: (payload: { source: string; id: string }) =>
    invokeLibrary("library:favorites:songs:remove", cloneIpcPayload(payload)),
  toggleFavoriteSong: (track: any) =>
    invokeLibrary("library:favorites:songs:toggle", cloneIpcPayload(track)),
  containsFavoriteSong: (payload: { source: string; id: string }) =>
    invokeLibrary("library:favorites:songs:contains", cloneIpcPayload(payload)),
  listFavoritePlaylists: () =>
    invokeLibrary("library:favorites:playlists:list"),
  addFavoritePlaylist: (playlist: any) =>
    invokeLibrary("library:favorites:playlists:add", cloneIpcPayload(playlist)),
  removeFavoritePlaylist: (payload: { source: string; id: string }) =>
    invokeLibrary("library:favorites:playlists:remove", cloneIpcPayload(payload)),
  toggleFavoritePlaylist: (playlist: any) =>
    invokeLibrary("library:favorites:playlists:toggle", cloneIpcPayload(playlist)),
  containsFavoritePlaylist: (payload: { source: string; id: string }) =>
    invokeLibrary("library:favorites:playlists:contains", cloneIpcPayload(payload)),
  onFavoritesChanged: (callback: () => void) => on("favorites:changed", callback),
  listUserPlaylists: (payload?: { source?: "kg" | "wy" | "kw" | "qq" | "local" | "all" }) =>
    invokeLibrary("library:playlists:list", cloneIpcPayload(payload ?? {})),
  createUserPlaylist: (playlist: any) =>
    invokeLibrary("library:playlists:create", cloneIpcPayload(playlist)),
  upsertUserPlaylist: (playlist: any) =>
    invokeLibrary("library:playlists:upsert", cloneIpcPayload(playlist)),
  replaceUserPlaylists: (payload: { source: "kg" | "wy" | "kw" | "qq"; playlists: any[] }) =>
    invokeLibrary("library:playlists:replace-source", cloneIpcPayload(payload)),
  listUserPlaylistTracks: (payload: { playlistId: string }) =>
    invokeLibrary("library:playlists:tracks:list", cloneIpcPayload(payload)),
  addUserPlaylistTrack: (payload: { playlistId: string; track: any }) =>
    invokeLibrary("library:playlists:tracks:add", cloneIpcPayload(payload)),
  listUserCloudSongs: (payload?: { cloudSource?: string | "all" }) =>
    ipcRenderer.invoke("library:cloud:songs:list", cloneIpcPayload(payload ?? {})),
  replaceUserCloudSongs: (payload: { cloudSource: string; songs: any[] }) =>
    ipcRenderer.invoke("library:cloud:songs:replace", cloneIpcPayload(payload)),
  listLocalSongs: () => ipcRenderer.invoke("library:local:songs:list"),
  getLocalLibraryScanStatus: () => ipcRenderer.invoke("library:local:scan-status"),
  refreshLocalLibrary: () => ipcRenderer.invoke("library:local:refresh"),
  getLocalSongCover: (filePath: string) => ipcRenderer.invoke("library:local:cover", filePath),
  removeLocalSongFromList: (payload: { filePath?: string; deleteFile?: boolean; localId?: string; fileId?: string }) =>
    ipcRenderer.invoke("library:local:songs:remove", cloneIpcPayload(payload)),
  onLocalLibraryScanStarted: (callback: (status: any) => void) =>
    on("local-library:scan-started", callback),
  onLocalLibraryScanFinished: (callback: (status: any) => void) =>
    on("local-library:scan-finished", callback),
  onLocalLibraryScanFailed: (callback: (status: any) => void) =>
    on("local-library:scan-failed", callback),
};

const systemIpc = {
  getAppVersion: () => ipcRenderer.invoke("system:get-app-version"),
  getBootstrapConfig: () => ipcRenderer.invoke("system:get-bootstrap"),
  getStartupServiceState: () => ipcRenderer.invoke("system:get-startup-service-state"),
  getRuntimeEndpoints: (fresh?: boolean) =>
    ipcRenderer.invoke("system:get-runtime-endpoints", fresh),
  getAnnouncements: () => ipcRenderer.invoke("system:get-announcements"),
  markAnnouncementRead: (id: string) => ipcRenderer.invoke("system:mark-announcement-read", id),
  getAboutInfo: () => ipcRenderer.invoke("system:get-about-info"),
  getAppShare: () => ipcRenderer.invoke("system:get-app-share"),
  getServiceAgreement: () => ipcRenderer.invoke("system:get-service-agreement"),
  getPrivacyPolicy: () => ipcRenderer.invoke("system:get-privacy-policy"),
  submitFeedback: (payload: {
    feedback_type: "bug" | "suggestion" | "account" | "other";
    description: string;
    contact?: string;
    device?: Record<string, unknown>;
    images?: {
      name: string;
      type: string;
      size: number;
      data: ArrayBuffer;
    }[];
  }) => ipcRenderer.invoke("system:submit-feedback", payload),
};

const accountIpc = {
  getAccountSession: () => ipcRenderer.invoke("account:session"),
  uploadAccountAvatar: () => ipcRenderer.invoke("account:upload-avatar"),
  refreshAccountSession: () => ipcRenderer.invoke("account:refresh"),
  logoutAccount: () => ipcRenderer.invoke("account:logout"),
  sendAccountEmailCode: (payload: { email: string; purpose: "register" | "login" | "reset_password" }) =>
    ipcRenderer.invoke("account:send-email-code", cloneIpcPayload(payload)),
  loginAccountByPassword: (payload: { identifier: string; password: string }) =>
    ipcRenderer.invoke("account:login-password", cloneIpcPayload(payload)),
  loginAccountByCode: (payload: { email: string; code: string }) =>
    ipcRenderer.invoke("account:login-code", cloneIpcPayload(payload)),
  registerAccount: (payload: { email: string; username: string; password: string; code: string }) =>
    ipcRenderer.invoke("account:register", cloneIpcPayload(payload)),
  sendProfileEmailCode: (payload: { email: string }) =>
    ipcRenderer.invoke("account:profile-email-code", cloneIpcPayload(payload)),
  updateAccountProfile: (payload: { username?: string; email?: string; code?: string; avatarKey?: string }) =>
    ipcRenderer.invoke("account:update-profile", cloneIpcPayload(payload)),
  changeAccountPassword: (payload: { currentPassword: string; newPassword: string }) =>
    ipcRenderer.invoke("account:change-password", cloneIpcPayload(payload)),
  resetAccountPassword: (payload: { email: string; code: string; newPassword: string }) =>
    ipcRenderer.invoke("account:reset-password", cloneIpcPayload(payload)),
};

const directMessageIpc = {
  listUnreadDirectMessages: () => ipcRenderer.invoke("direct-message:list-unread"),
  dismissDirectMessage: (id: string) => ipcRenderer.send("direct-message:dismiss", id),
};

const syncIpc = {
  getSyncState: () => ipcRenderer.invoke("sync:state"),
  syncNow: () => ipcRenderer.invoke("sync:now"),
  clearSyncState: () => ipcRenderer.invoke("sync:clear-state"),
  onSyncChanged: (callback: (state: any) => void) => on("sync:changed", callback),
  onMineLibraryChanged: (callback: () => void) => on("mine-library:changed", callback),
};

const shareIpc = {
  createShare: (payload: { type: "song" | "playlist"; rawJson: unknown }) =>
    ipcRenderer.invoke("share:create", cloneIpcPayload(payload)),
  getPublicShare: (uuid: string) => ipcRenderer.invoke("share:public", uuid),
  onExternalShareInvite: (callback: (invite: unknown) => void) =>
    on("share:invite", callback),
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
  enqueueDownloads: (items: import("../src/types/download").DownloadEnqueueItem[], options?: import("../src/types/download").DownloadEnqueueOptions) => ipcRenderer.invoke("download:enqueue", cloneIpcPayload(items), cloneIpcPayload(options)),
  pauseDownload: (id: string) => ipcRenderer.invoke("download:pause", id),
  resumeDownload: (id: string) => ipcRenderer.invoke("download:resume", id),
  pauseAllDownloads: () => ipcRenderer.invoke("download:pause-all"),
  resumeAllDownloads: () => ipcRenderer.invoke("download:resume-all"),
  cancelDownload: (id: string) => ipcRenderer.invoke("download:cancel", id),
  retryDownload: (id: string) => ipcRenderer.invoke("download:retry", id),
  getDownloadDetail: (id: string) => ipcRenderer.invoke("download:detail", id),
  selectDownloadTaskDirectory: (id: string) => ipcRenderer.invoke("download:select-task-directory", id),
  previewDownloadDelete: (input: { targets?: import("../src/types/download").DownloadFileTarget[]; all?: boolean }) => ipcRenderer.invoke("download:delete-preview", cloneIpcPayload(input)),
  deleteDownloads: (input: { previewId: string; deleteFiles: boolean; confirmed?: boolean }) => ipcRenderer.invoke("download:delete", cloneIpcPayload(input)),
  getDownloadFileDetail: (target: import("../src/types/download").DownloadFileTarget) => ipcRenderer.invoke("download:file-detail", cloneIpcPayload(target)),
  revealDownloadFile: (target: import("../src/types/download").DownloadFileTarget) => ipcRenderer.invoke("download:reveal-file", cloneIpcPayload(target)),
  openDownloadDirectory: (target: import("../src/types/download").DownloadFileTarget) => ipcRenderer.invoke("download:open-directory", cloneIpcPayload(target)),
  repairDownloadFile: (target: import("../src/types/download").DownloadFileTarget) => ipcRenderer.invoke("download:repair", cloneIpcPayload(target)),
  listDownloadFiles: () => ipcRenderer.invoke("download:files"),
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

const listenTogetherIpc = {
  getListenTogetherConfig: () => ipcRenderer.invoke("listen-together:get-config"),
  createListenTogetherRoom: (payload: {
    roomName: string;
    roomId?: string;
    maxPeople?: number;
    memberOperation: boolean;
    replaceExisting?: boolean;
  }) => ipcRenderer.invoke("listen-together:create-room", cloneIpcPayload(payload)),
  getListenTogetherRoom: (roomId: string) =>
    ipcRenderer.invoke("listen-together:get-room", roomId),
  connectListenTogetherSocket: () => ipcRenderer.invoke("listen-together:connect-socket"),
  disconnectListenTogetherSocket: () => ipcRenderer.invoke("listen-together:disconnect-socket"),
  emitListenTogetherCommand: (command: { type: string; roomId: string } & Record<string, unknown>) =>
    ipcRenderer.invoke("listen-together:emit", cloneIpcPayload(command)),
  onListenTogetherConnectionState: (callback: (event: unknown) => void) =>
    on("listen-together:connection", callback),
  onListenTogetherBroadcast: (callback: (message: unknown) => void) =>
    on("listen-together:broadcast", callback),
  onListenTogetherInvite: (callback: (invite: unknown) => void) =>
    on("listen-together:invite", callback),
};

const debugIpc = {
  isDevelopmentRuntime: () => ipcRenderer.invoke("debug:is-development-runtime"),
  listNetworkErrors: (payload?: { page?: number; pageSize?: number }) =>
    ipcRenderer.invoke("debug:network-errors:list", cloneIpcPayload(payload)),
  getNetworkErrorDetail: (id: number) => ipcRenderer.invoke("debug:network-errors:detail", id),
  exportNetworkErrors: (limit: 10 | 100) =>
    ipcRenderer.invoke("debug:network-errors:export", limit),
};

const faultReportIpc = {
  getFaultReportStats: () => ipcRenderer.invoke("fault-report:stats"),
  submitPendingFaultReport: () => ipcRenderer.invoke("fault-report:submit-pending"),
};

const cloudMusicIpc = {
  getCloudMusicSummary: () => ipcRenderer.invoke("cloud-music:summary"),
  searchCloudMusic: (input: { keyword?: string; offset?: number; limit?: number }) =>
    ipcRenderer.invoke("cloud-music:search", cloneIpcPayload(input)),
  getCloudMusicTrack: (uuid: string) =>
    ipcRenderer.invoke("cloud-music:detail", uuid),
  createCloudMusicSubmitSession: (input: any) =>
    ipcRenderer.invoke("cloud-music:submit:create-session", cloneIpcPayload(input)),
  reserveCloudMusicSubmitAsset: (payload: { uuid: string; input: any }) =>
    ipcRenderer.invoke("cloud-music:submit:reserve-asset", cloneIpcPayload(payload)),
  completeCloudMusicSubmitAsset: (payload: { uuid: string; kind: "audio" | "cover-uploaded" | "lyrics" }) =>
    ipcRenderer.invoke("cloud-music:submit:complete-asset", cloneIpcPayload(payload)),
  removeCloudMusicSubmitCover: (payload: { uuid: string }) =>
    ipcRenderer.invoke("cloud-music:submit:remove-cover", cloneIpcPayload(payload)),
  saveCloudMusicSubmission: (payload: { uuid: string; input: any }) =>
    ipcRenderer.invoke("cloud-music:submit:save", cloneIpcPayload(payload)),
  getMyCloudMusicSubmissions: (payload?: { offset?: number; limit?: number }) =>
    ipcRenderer.invoke("cloud-music:submit:my-history", cloneIpcPayload(payload)),
  resubmitCloudMusicTrack: (payload: { uuid: string; input: any }) =>
    ipcRenderer.invoke("cloud-music:submit:resubmit", cloneIpcPayload(payload)),
};

const listeningIpc = {
  observeListeningPlayback: (observation: any) =>
    ipcRenderer.send("listening:observe", cloneIpcPayload(observation)),
  getListeningSummary: () => ipcRenderer.invoke("listening:summary"),
};

const playerControlsIpc = {
  startPlayerControlsTracking: () => ipcRenderer.send("player-controls:tracking:start"),
  stopPlayerControlsTracking: () => ipcRenderer.send("player-controls:tracking:stop"),
  notifyPlayerControlsInteraction: () => ipcRenderer.send("player-controls:interaction"),
  onPlayerControlsVisibility: (
    callback: (event: import("../src/types/playerControls").PlayerControlsVisibilityEvent) => void,
  ) => on("player-controls:visibility", callback),
};

contextBridge.exposeInMainWorld("electronAPI", {
  ...windowIpc,
  ...startupIpc,
  ...updaterIpc,
  ...logIpc,
  ...desktopLyricIpc,
  ...systemIpc,
  ...accountIpc,
  ...directMessageIpc,
  ...syncIpc,
  ...shareIpc,
  ...musicApiIpc,
  ...cookieApiIpc,
  ...downloadApiIpc,
  ...mediaCacheIpc,
  ...settingsIpc,
  ...playlistCoverIpc,
  ...shortcutIpc,
  ...libraryIpc,
  ...utilsIpc,
  ...listenTogetherIpc,
  ...debugIpc,
  ...faultReportIpc,
  ...cloudMusicIpc,
  ...listeningIpc,
  ...playerControlsIpc,
  ...lowPowerIpc,
});
