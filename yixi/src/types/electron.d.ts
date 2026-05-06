export {};

type MusicSource = "kg" | "wy" | "kw" | "qq" | string;

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

  getSetting: <T = unknown>(key: string) => Promise<SettingRecord<T> | null>;
  setSetting: (key: string, value: unknown, version?: number) => Promise<SettingRecord | null>;
  deleteSetting: (key: string) => Promise<boolean>;
  addSearchHistory: (payload: { keyword: string; source?: string | null }) => Promise<SearchHistoryItem | null>;
  listSearchHistory: (limit?: number) => Promise<SearchHistoryItem[]>;
  clearSearchHistory: () => Promise<boolean>;
  addPlayHistory: (track: TrackSnapshot) => Promise<PlayHistoryItem | null>;
  listPlayHistory: (limit?: number) => Promise<PlayHistoryItem[]>;
  getQueueSnapshot: () => Promise<QueueSnapshot>;
  saveQueueSnapshot: (snapshot: { currentIndex: number; queue: TrackSnapshot[] }) => Promise<QueueSnapshot>;

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
