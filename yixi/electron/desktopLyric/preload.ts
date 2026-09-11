import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopLyricBounds,
  DesktopLyricClockSync,
  DesktopLyricControlAction,
  DesktopLyricPayload,
  DesktopLyricSettingV2,
  DesktopLyricSnapshot,
  DesktopLyricWindowBridge,
} from "../../src/types/desktopLyric";


const desktopLyricWindowBridge: DesktopLyricWindowBridge = {
  ready: () => {
    ipcRenderer.send("desktop-lyric-window:ready");
    ipcRenderer.send("desktop-lyric:ready");
  },
  control: (action: DesktopLyricControlAction) => {
    ipcRenderer.send("desktop-lyric-window:control", action);
  },
  setLocked: (locked: boolean) => {
    ipcRenderer.send("desktop-lyric-window:set-locked", locked);
  },
  requestBounds: (bounds: DesktopLyricBounds) => {
    ipcRenderer.send("desktop-lyric-window:request-bounds", bounds);
  },
  onSnapshot: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      snapshot: DesktopLyricSnapshot,
    ) => {
      callback(snapshot);
    };
    ipcRenderer.on("desktop-lyric-window:snapshot", handler);
    ipcRenderer.on("desktop-lyric:snapshot", handler);
    return () => {
      ipcRenderer.removeListener("desktop-lyric-window:snapshot", handler);
      ipcRenderer.removeListener("desktop-lyric:snapshot", handler);
    };
  },
  onClock: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      clock: DesktopLyricClockSync,
    ) => {
      callback(clock);
    };
    ipcRenderer.on("desktop-lyric-window:clock", handler);
    return () => {
      ipcRenderer.removeListener("desktop-lyric-window:clock", handler);
    };
  },
  onLyric: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      lyric: DesktopLyricPayload,
    ) => {
      callback(lyric);
    };
    ipcRenderer.on("desktop-lyric-window:lyric", handler);
    return () => {
      ipcRenderer.removeListener("desktop-lyric-window:lyric", handler);
    };
  },
  onSetting: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      setting: DesktopLyricSettingV2,
    ) => {
      callback(setting);
    };
    ipcRenderer.on("desktop-lyric-window:setting", handler);
    return () => {
      ipcRenderer.removeListener("desktop-lyric-window:setting", handler);
    };
  },
};

contextBridge.exposeInMainWorld("desktopLyricWindow", desktopLyricWindowBridge);
