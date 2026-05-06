import type { SearchHistoryItem, PlayHistoryItem, QueueSnapshot } from "./library";
import type { LyricRequest, LyricResult, PlayUrlResult, ResolveUrlRequest, SearchRequest, SourceGroupedResult, TrackSearchResult } from "./music";
import type { AppSettings, AppThemeSettings } from "./settings";
import type { AnnouncementItem, BootstrapConfigData, FeedbackPayload, SystemStatus } from "./system";

export interface PisaApi {
  system: {
    refreshConfig(): Promise<BootstrapConfigData>;
    getStatus(): Promise<SystemStatus>;
    getAnnouncements(): Promise<AnnouncementItem[]>;
    submitFeedback(payload: FeedbackPayload): Promise<void>;
  };
  music: {
    search(request: SearchRequest): Promise<SourceGroupedResult>;
    resolveUrl(request: ResolveUrlRequest): Promise<PlayUrlResult>;
    getLyric(request: LyricRequest): Promise<LyricResult>;
  };
  library: {
    getSearchHistory(): Promise<SearchHistoryItem[]>;
    addSearchHistory(keyword: string): Promise<void>;
    getPlayHistory(): Promise<PlayHistoryItem[]>;
    addPlayHistory(track: TrackSearchResult): Promise<void>;
    getQueueSnapshot(): Promise<QueueSnapshot | null>;
    saveQueueSnapshot(snapshot: QueueSnapshot): Promise<void>;
  };
  settings: {
    get(): Promise<AppSettings>;
    save(settings: AppSettings): Promise<AppSettings>;
    saveTheme(theme: AppThemeSettings): Promise<AppSettings>;
  };
  player: {
    onTrayCommand(callback: (command: TrayPlayerCommand) => void): () => void;
    setPlaybackState(state: TrayPlaybackState): Promise<void>;
  };
  window: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
  };
}

export type TrayPlayerCommand = "toggle-play" | "previous" | "next";

export interface TrayPlaybackState {
  isPlaying: boolean;
  title?: string;
}

export const IPC_CHANNELS = {
  systemRefreshConfig: "system:refresh-config",
  systemStatus: "system:status",
  systemAnnouncements: "system:announcements",
  systemFeedback: "system:feedback",
  musicSearch: "music:search",
  musicResolveUrl: "music:resolve-url",
  musicLyric: "music:lyric",
  librarySearchHistoryGet: "library:search-history:get",
  librarySearchHistoryAdd: "library:search-history:add",
  libraryPlayHistoryGet: "library:play-history:get",
  libraryPlayHistoryAdd: "library:play-history:add",
  libraryQueueGet: "library:queue:get",
  libraryQueueSave: "library:queue:save",
  settingsGet: "settings:get",
  settingsSave: "settings:save",
  settingsSaveTheme: "settings:save-theme",
  playerTrayCommand: "player:tray-command",
  playerState: "player:state",
  windowMinimize: "window:minimize",
  windowToggleMaximize: "window:toggle-maximize",
  windowClose: "window:close",
  windowIsMaximized: "window:is-maximized",
} as const;
