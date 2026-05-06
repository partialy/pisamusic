import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type PisaApi, type TrayPlayerCommand } from "@shared/ipc";

const api: PisaApi = {
  system: {
    refreshConfig: () => ipcRenderer.invoke(IPC_CHANNELS.systemRefreshConfig),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.systemStatus),
    getAnnouncements: () => ipcRenderer.invoke(IPC_CHANNELS.systemAnnouncements),
    submitFeedback: (payload) => ipcRenderer.invoke(IPC_CHANNELS.systemFeedback, payload),
  },
  music: {
    search: (request) => ipcRenderer.invoke(IPC_CHANNELS.musicSearch, request),
    resolveUrl: (request) => ipcRenderer.invoke(IPC_CHANNELS.musicResolveUrl, request),
    getLyric: (request) => ipcRenderer.invoke(IPC_CHANNELS.musicLyric, request),
  },
  library: {
    getSearchHistory: () => ipcRenderer.invoke(IPC_CHANNELS.librarySearchHistoryGet),
    addSearchHistory: (keyword) => ipcRenderer.invoke(IPC_CHANNELS.librarySearchHistoryAdd, keyword),
    getPlayHistory: () => ipcRenderer.invoke(IPC_CHANNELS.libraryPlayHistoryGet),
    addPlayHistory: (track) => ipcRenderer.invoke(IPC_CHANNELS.libraryPlayHistoryAdd, track),
    getQueueSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.libraryQueueGet),
    saveQueueSnapshot: (snapshot) => ipcRenderer.invoke(IPC_CHANNELS.libraryQueueSave, snapshot),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    save: (settings) => ipcRenderer.invoke(IPC_CHANNELS.settingsSave, settings),
    saveTheme: (theme) => ipcRenderer.invoke(IPC_CHANNELS.settingsSaveTheme, theme),
  },
  player: {
    onTrayCommand: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, command: TrayPlayerCommand) => callback(command);
      ipcRenderer.on(IPC_CHANNELS.playerTrayCommand, listener);
      return () => ipcRenderer.off(IPC_CHANNELS.playerTrayCommand, listener);
    },
    setPlaybackState: (state) => ipcRenderer.invoke(IPC_CHANNELS.playerState, state),
  },
  window: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.windowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.windowToggleMaximize),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.windowClose),
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.windowIsMaximized),
  },
};

contextBridge.exposeInMainWorld("pisa", api);
