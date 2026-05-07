export {};

type MusicSource = "kg" | "wy" | "kw" | "qq" | string;
type SearchableMusicSource = "kg" | "wy" | "kw";

type WindowLyricSettingValue = {
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
  name?: string;
  singer?: string;
  album?: string;
  cover?: string;
  duration?: number;
  [key: string]: unknown;
};

type SettingRecord<T = unknown> = {
  key: string;
  value: T;
  version: number;
  updatedAt: string;
};

type QueueSnapshot = {
  currentIndex: number;
  queue: TrackSnapshot[];
  updatedAt: string;
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

type ElectronIpcApi = {
  collectSong: (song: unknown) => void;
  inCollectSong: (song: unknown) => void;
  removeSong: (song: unknown) => void;
  collectedSongs: () => Promise<any[]>;
  collectList: (list: unknown) => void;
  inCollectList: (list: unknown) => void;
  removeList: (list: unknown) => void;
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

  log: (message: unknown) => void;
  collectError: (error: unknown) => void;
  getLogs: (date: Date) => Promise<any>;
  readFile: (params: { filename: string; folder: string; dataType?: "object" | "list" }) => Promise<any>;
  writeFile: (params: { filename: string; folder: string; data: string }) => Promise<any>;

  openLyricWindow: () => void;
  changeCurrentSong: (currentSong: TrackSnapshot | null) => void;
  isPlaying: (isPlaying: boolean) => void;
  updateTime: (t: number) => void;
  mediaControl: (action: "play" | "pause" | "next" | "prev" | "previous", data?: unknown) => void;
  setLyrics: (lyric: { type: "krc" | "lrc"; data: string }) => void;
  setLyricStyle: (config: WindowLyricSettingValue) => void;
  lockLyric: (lock: boolean) => void;
  onMediaControl: (
    callback: (action: "play" | "pause" | "next" | "prev", ...args: any[]) => void
  ) => () => void;

  openCookieWindow: (t: "kg" | "wy") => void;
  readCookie: (t: "kg" | "wy") => Promise<string>;
  refreshKGCookie: (data: string) => Promise<any>;

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
  getPlaylistDetail: <T = any>(payload: PlaylistDetailParams) => Promise<T>;
  getPlaylistTracks: <T = any>(payload: PlaylistTracksParams) => Promise<T>;
  getDynamicCover: <T = any>(payload: DynamicCoverParams) => Promise<T>;
  resolveMusicUrl: <T = any>(payload: MusicUrlParams) => Promise<T>;
  resolvePlayableUrl: (track: TrackSnapshot | { source: SearchableMusicSource; urlParam?: string; id?: string }) => Promise<string>;
  fetchLyrics: (payload: MusicLyricParams) => Promise<MusicLyricResult>;

  getSetting: <T = unknown>(key: string) => Promise<SettingRecord<T> | null>;
  setSetting: (key: string, value: unknown, version?: number) => Promise<SettingRecord | null>;
  deleteSetting: (key: string) => Promise<boolean>;
  addSearchHistory: (payload: { keyword: string; source?: string | null }) => Promise<SearchHistoryItem | null>;
  listSearchHistory: (limit?: number) => Promise<SearchHistoryItem[]>;
  clearSearchHistory: () => Promise<boolean>;
  deleteSearchHistory: (id: number) => Promise<boolean>;
  addPlayHistory: (track: any) => Promise<PlayHistoryItem | null>;
  listPlayHistory: (limit?: number) => Promise<PlayHistoryItem[]>;
  getQueueSnapshot: () => Promise<QueueSnapshot>;
  saveQueueSnapshot: (snapshot: { currentIndex: number; queue: any[] }) => Promise<QueueSnapshot>;

  getStore: (key: string) => Promise<unknown>;
  setStore: (key: string, value: unknown) => Promise<boolean>;
  deleteStore: (key: string) => Promise<boolean>;
  clearStore: () => Promise<boolean>;
  getRequestUrl: () => Promise<any>;
  getPlayUrl: (song: unknown) => Promise<any>;
  getElectronConfig: () => Promise<any>;
  getServerPort: () => Promise<{ backServer: BackServerConfig; [key: string]: unknown }>;
};

declare global {
  type WindowLyricSetting = WindowLyricSettingValue;
  type ElectronIpc = ElectronIpcApi;

  interface Window {
    electronAPI: ElectronIpcApi;
  }
}
