export {};

type MusicSource = "kg" | "wy" | "kw" | "qq" | string;
type SearchableMusicSource = "kg" | "wy" | "kw";
type PlayableMusicSource = SearchableMusicSource | "local";

type WindowLyricSettingValue = {
  width: number;
  height: number;
  overlayTaskbar: boolean;
  autoFontSize: boolean;
  maxSize: number;
  minSize: number;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  highlightColor: string;
  fontWeight: number;
};

type TrackSnapshot = {
  id: string;
  source: MusicSource;
  urlParam?: string;
  name?: string;
  singer?: string;
  album?: string;
  cover?: string;
  d_cover?: string;
  coverSize?: {
    s: string;
    m: string;
    l: string;
    xl: string;
  };
  lyric?: string;
  krc?: string;
  size?: Record<string, number>;
  vip?: boolean;
  duration?: number;
  filePath?: string;
};

type PlaylistSnapshot = {
  id: string;
  source: "kg" | "wy" | "kw" | "qq";
  name: string;
  desc: string;
  cover: string;
  coverSize?: {
    s: string;
    m: string;
    l: string;
    xl: string;
  };
  tags: {
    name: string;
    id: string;
  }[];
  song_count?: number | string;
  play_count?: number | string;
  collect_count?: number | string;
};

type SettingRecord<T = unknown> = {
  key: string;
  value: T;
  version: number;
  updatedAt: string;
};

type LocalSongNamingMode =
  | "artist-title"
  | "title-artist"
  | "title"
  | "index-title-artist";

type LocalAppSetting = {
  scanDirectories: string[];
  cacheDirectory: string;
  cacheLimitGb: number;
  downloadDirectory: string;
  songNamingMode: LocalSongNamingMode;
};

type LocalLibraryScanStatus = {
  scanning: boolean;
  lastStartedAt: string;
  lastFinishedAt: string;
  lastError: string;
  total: number;
  directories: string[];
  skipped: boolean;
};

type QueueSnapshot = {
  currentIndex: number;
  queue: TrackSnapshot[];
  updatedAt: string;
};

type FavoriteSongItem = {
  favoriteKey: string;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload: TrackSnapshot;
  createdAt: string;
};

type FavoritePlaylistItem = {
  favoriteKey: string;
  playlistId: string;
  source: string;
  name: string;
  description: string;
  artwork: string;
  songCount: string;
  playCount: string;
  collectCount: string;
  payload: PlaylistSnapshot;
  createdAt: string;
};

type BootstrapConfig = {
  version: string;
  updatedAt: number;
  endpoints: Record<string, string>;
  gatewaySign?: {
    secret: string;
    as: string;
  };
};

type Announcement = {
  id: string;
  content: string;
  time: string;
  publisher: string;
  confirmText: string;
  showEveryTime?: boolean;
  showGotoButton: boolean;
  gotoUrl?: string;
};

type FeedbackPayload = {
  feedback_type: "bug" | "suggestion" | "account" | "other";
  description: string;
  contact?: string;
  device?: Record<string, unknown>;
};

type SearchHistoryItem = {
  id: number;
  keyword: string;
  source: string | null;
  createdAt: string;
};

type PlayHistoryItem = {
  id: number;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload: TrackSnapshot;
  playedAt: string;
};

type NetworkErrorRecordSummary = {
  id: number;
  requestScope: string;
  method: string;
  requestPath: string;
  httpStatus: number | null;
  businessCode: string | null;
  errorMessage: string;
  createdAt: string;
};

type NetworkErrorRecordDetail = NetworkErrorRecordSummary & {
  requestUrl: string;
  requestParams: unknown;
  response: unknown;
};

type NetworkErrorRecordPage = {
  items: NetworkErrorRecordSummary[];
  total: number;
  page: number;
  pageSize: number;
};

type NetworkErrorExportResult = {
  exported: boolean;
  filePath: string | null;
  count: number;
};

type BackServerConfig = {
  kgServer: string;
  wyServer: string;
  kwServer: string;
  kgProxy: string;
  wyProxy: string;
  kwProxy: string;
};

type MusicSearchParams = {
  source: SearchableMusicSource;
  keywords: string;
  page?: number;
  pageSize?: number;
};

type MusicSuggestParams = {
  source?: "wy";
  keywords: string;
};

type PlaylistSearchParams = {
  source: "kg" | "wy";
  keywords: string;
  page?: number;
  pageSize?: number;
};

type TopPlaylistParams = {
  source: "kg";
  categoryId?: string | number;
  page?: number;
  pageSize?: number;
};

type PlaylistDetailParams = {
  source: "kg" | "wy";
  id: string;
};

type PlaylistTracksParams = {
  source: "kg" | "wy";
  id: string;
  offset?: number;
  page?: number;
  pageSize?: number;
};

type DynamicCoverParams = {
  source: "wy";
  id: string | number;
};

type MusicUrlParams = {
  source: SearchableMusicSource;
  id: string;
  quality?: string;
  br?: number;
};

type MusicLyricParams = {
  source: SearchableMusicSource;
  id?: string;
  hash?: string;
};

type MusicLyricResult = {
  krc: string;
  lrc: string;
};

type CookieSource = "kg" | "wy";

type CookieAccountProfile = {
  source: CookieSource;
  loggedIn: boolean;
  userId: string;
  nickname: string;
  avatar: string;
  isVip: boolean;
  expiresAt: string;
  raw?: unknown;
};

type KgQrLoginSnapshot = {
  loginId: string;
  qrcodeImg: string;
};

type KgQrLoginStatus = {
  status: "waiting" | "confirming" | "expired" | "success" | "failed";
  message?: string;
  nickname?: string;
  avatar?: string;
  saved: boolean;
};

type WyLoginWindowResult = {
  saved: boolean;
  hasMusicU: boolean;
};

type CookieDebugApiResult = {
  source: CookieSource;
  endpoint: string;
  httpStatus: number;
  ok: boolean;
  cookieHeaderForNextRequest: string;
  body: unknown;
};

type CookieFileExportResult = {
  exported: boolean;
  directory: string | null;
  exportedFiles: string[];
  skippedFiles: string[];
};

type ElectronIpcApi = {
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

  log: (message: unknown) => Promise<boolean>;
  reportError: (error: unknown, context?: Record<string, unknown>) => Promise<boolean>;
  getLogs: (date?: Date | string) => Promise<any>;
  openLogsDir: () => Promise<boolean>;

  openLyricWindow: () => Promise<unknown>;
  closeLyricWindow: () => Promise<boolean>;
  toggleLyricWindow: () => Promise<unknown>;
  changeCurrentSong: (currentSong: TrackSnapshot | null) => void;
  isPlaying: (isPlaying: boolean) => void;
  updateTime: (t: number) => void;
  mediaControl: (action: "play" | "pause" | "next" | "prev" | "previous", data?: unknown) => void;
  setLyrics: (lyric: { type: "krc" | "lrc"; data: string }) => void;
  setLyricStyle: (config: WindowLyricSettingValue) => void;
  lockLyric: (lock: boolean) => void;
  onLyricLockedStatus: (callback: (locked: boolean) => void) => () => void;
  onBoundsChanged: (callback: (bounds: { width: number; height: number }) => void) => () => void;
  onMediaControl: (
    callback: (action: "play" | "pause" | "next" | "prev", ...args: any[]) => void
  ) => () => void;

  getSystemBaseUrl: () => Promise<string>;
  getBootstrapConfig: () => Promise<BootstrapConfig>;
  getRuntimeEndpoints: (fresh?: boolean) => Promise<BackServerConfig>;
  getAnnouncements: () => Promise<Announcement[]>;
  submitFeedback: (payload: FeedbackPayload) => Promise<{ id: string; createdAt: string }>;
  searchMusic: <T = any>(payload: MusicSearchParams) => Promise<T>;
  searchSuggest: <T = any>(payload: MusicSuggestParams) => Promise<T>;
  searchPlaylists: <T = any>(payload: PlaylistSearchParams) => Promise<T>;
  getKgPlaylistTags: <T = any>() => Promise<T>;
  getTopPlaylists: <T = any>(payload: TopPlaylistParams) => Promise<T>;
  getKgDailyRecommend: <T = any>(platform?: string) => Promise<T>;
  getHomeRecommendations: <T = any>() => Promise<T>;
  getPlaylistDetail: <T = any>(payload: PlaylistDetailParams) => Promise<T>;
  getPlaylistTracks: <T = any>(payload: PlaylistTracksParams) => Promise<T>;
  getDynamicCover: <T = any>(payload: DynamicCoverParams) => Promise<T>;
  resolveMusicUrl: <T = any>(payload: MusicUrlParams) => Promise<T>;
  resolvePlayableUrl: (track: TrackSnapshot | { source: PlayableMusicSource; urlParam?: string; id?: string; filePath?: string }) => Promise<string>;
  fetchLyrics: (payload: MusicLyricParams) => Promise<MusicLyricResult>;
  getUserCookie: (source: CookieSource) => Promise<string>;
  clearUserCookie: (source: CookieSource) => Promise<boolean>;
  kgSendCaptcha: <T = any>(payload: { mobile: string }) => Promise<T>;
  kgLoginWithCode: (payload: { mobile: string; code: string }) => Promise<CookieAccountProfile>;
  kgStartQrLogin: () => Promise<KgQrLoginSnapshot>;
  kgCheckQrLogin: (payload: { loginId: string }) => Promise<KgQrLoginStatus>;
  wyOpenLoginWindow: (payload: { mode: "pc" | "mobile" }) => Promise<WyLoginWindowResult>;
  getCookieAccountProfile: (payload: { source: CookieSource }) => Promise<CookieAccountProfile>;
  getCookieDebugUserInfo: (source: CookieSource) => Promise<CookieDebugApiResult>;
  exportCookieFiles: () => Promise<CookieFileExportResult>;
  getCookieUserPlaylists: <T = any>(payload: {
    source: CookieSource;
    page?: number;
    pageSize?: number;
    uid?: string | number;
    offset?: number;
  }) => Promise<T>;

  getSetting: <T = unknown>(key: string) => Promise<SettingRecord<T> | null>;
  setSetting: (key: string, value: unknown, version?: number) => Promise<SettingRecord | null>;
  deleteSetting: (key: string) => Promise<boolean>;
  selectDirectory: (title?: string) => Promise<string | null>;
  addSearchHistory: (payload: { keyword: string; source?: string | null }) => Promise<SearchHistoryItem | null>;
  listSearchHistory: (limit?: number) => Promise<SearchHistoryItem[]>;
  clearSearchHistory: () => Promise<boolean>;
  deleteSearchHistory: (id: number) => Promise<boolean>;
  addPlayHistory: (track: any) => Promise<PlayHistoryItem | null>;
  listPlayHistory: (limit?: number) => Promise<PlayHistoryItem[]>;
  getQueueSnapshot: () => Promise<QueueSnapshot>;
  saveQueueSnapshot: (snapshot: { currentIndex: number; queue: any[] }) => Promise<QueueSnapshot>;
  listFavoriteSongs: () => Promise<FavoriteSongItem[]>;
  addFavoriteSong: (track: TrackSnapshot) => Promise<FavoriteSongItem | null>;
  removeFavoriteSong: (payload: { source: string; id: string }) => Promise<boolean>;
  toggleFavoriteSong: (track: TrackSnapshot) => Promise<{ collected: boolean; item: FavoriteSongItem | null }>;
  containsFavoriteSong: (payload: { source: string; id: string }) => Promise<boolean>;
  listFavoritePlaylists: () => Promise<FavoritePlaylistItem[]>;
  addFavoritePlaylist: (playlist: PlaylistSnapshot) => Promise<FavoritePlaylistItem | null>;
  removeFavoritePlaylist: (payload: { source: string; id: string }) => Promise<boolean>;
  toggleFavoritePlaylist: (playlist: PlaylistSnapshot) => Promise<{ collected: boolean; item: FavoritePlaylistItem | null }>;
  containsFavoritePlaylist: (payload: { source: string; id: string }) => Promise<boolean>;
  onFavoritesChanged: (callback: () => void) => () => void;
  listLocalSongs: () => Promise<TrackSnapshot[]>;
  getLocalLibraryScanStatus: () => Promise<LocalLibraryScanStatus>;
  refreshLocalLibrary: () => Promise<LocalLibraryScanStatus>;
  onLocalLibraryScanStarted: (callback: (status: LocalLibraryScanStatus) => void) => () => void;
  onLocalLibraryScanFinished: (callback: (status: LocalLibraryScanStatus) => void) => () => void;
  onLocalLibraryScanFailed: (callback: (status: LocalLibraryScanStatus) => void) => () => void;

  getColorFromUrl: (url: string) => Promise<string>;
  isDevelopmentRuntime: () => Promise<boolean>;
  listNetworkErrors: (payload?: { page?: number; pageSize?: number }) => Promise<NetworkErrorRecordPage>;
  getNetworkErrorDetail: (id: number) => Promise<NetworkErrorRecordDetail | null>;
  exportNetworkErrors: (limit: 10 | 100) => Promise<NetworkErrorExportResult>;
};

declare global {
  type WindowLyricSetting = WindowLyricSettingValue;
  type ElectronIpc = ElectronIpcApi;

  interface Window {
    electronAPI: ElectronIpcApi;
  }
}
