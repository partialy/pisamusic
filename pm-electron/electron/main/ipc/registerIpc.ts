import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS, type TrayPlaybackState } from "@shared/ipc";
import type { QueueSnapshot } from "@shared/library";
import type { LyricRequest, ResolveUrlRequest, SearchRequest, TrackSearchResult } from "@shared/music";
import type { AppSettings, AppThemeSettings } from "@shared/settings";
import {
  addPlayHistory,
  addSearchHistory,
  readPlayHistory,
  readQueueSnapshot,
  readSearchHistory,
  readSettings,
  writeQueueSnapshot,
  writeSettings,
} from "@main/db/database";
import { getAnnouncements, getSystemStatus, refreshBootstrapConfig, submitFeedback } from "@main/services/systemService";
import { getLyric, resolvePlayUrl, searchMusic } from "@main/services/musicService";
import { setTrayPlaybackState } from "@main/tray/appTray";
import type { FeedbackPayload } from "@shared/system";

export function registerIpc(win: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.systemRefreshConfig, () => refreshBootstrapConfig());
  ipcMain.handle(IPC_CHANNELS.systemStatus, () => getSystemStatus());
  ipcMain.handle(IPC_CHANNELS.systemAnnouncements, () => getAnnouncements());
  ipcMain.handle(IPC_CHANNELS.systemFeedback, (_event, payload: FeedbackPayload) => submitFeedback(payload));

  ipcMain.handle(IPC_CHANNELS.musicSearch, (_event, request: SearchRequest) => searchMusic(request));
  ipcMain.handle(IPC_CHANNELS.musicResolveUrl, (_event, request: ResolveUrlRequest) => resolvePlayUrl(request));
  ipcMain.handle(IPC_CHANNELS.musicLyric, (_event, request: LyricRequest) => getLyric(request));

  ipcMain.handle(IPC_CHANNELS.librarySearchHistoryGet, () => readSearchHistory());
  ipcMain.handle(IPC_CHANNELS.librarySearchHistoryAdd, (_event, keyword: string) => addSearchHistory(keyword));
  ipcMain.handle(IPC_CHANNELS.libraryPlayHistoryGet, () => readPlayHistory());
  ipcMain.handle(IPC_CHANNELS.libraryPlayHistoryAdd, (_event, track: TrackSearchResult) => addPlayHistory(track));
  ipcMain.handle(IPC_CHANNELS.libraryQueueGet, () => readQueueSnapshot());
  ipcMain.handle(IPC_CHANNELS.libraryQueueSave, (_event, snapshot: QueueSnapshot) => writeQueueSnapshot(snapshot));

  ipcMain.handle(IPC_CHANNELS.settingsGet, () => readSettings());
  ipcMain.handle(IPC_CHANNELS.settingsSave, (_event, settings: AppSettings) => writeSettings(settings));
  ipcMain.handle(IPC_CHANNELS.settingsSaveTheme, (_event, theme: AppThemeSettings) => {
    const current = readSettings();
    return writeSettings({ ...current, theme });
  });
  ipcMain.handle(IPC_CHANNELS.playerState, (_event, state: TrayPlaybackState) => setTrayPlaybackState(win, state));
}
