import {
  BrowserWindow,
  ipcMain,
  screen,
  type BrowserWindowConstructorOptions,
} from "electron";
import path from "path";
import { appStore } from "./store";
import { logger } from "./utils/logger";

export type PlayerAction = "play" | "pause" | "next" | "prev" | "close";

type DesktopLyricStyle = {
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
  fontWeight: number | string;
};

type DesktopLyricSnapshot = {
  song: unknown | null;
  lyrics: {
    type: "krc" | "lrc";
    lines: unknown[];
  };
  currentTime: number;
  isPlaying: boolean;
  style: DesktopLyricStyle;
  locked: boolean;
  visible: boolean;
};

type DesktopLyricManagerOptions = {
  iconPath: string;
  getMainWindow: () => BrowserWindow | null;
  onStateChanged?: () => void;
};

export class DesktopLyricManager {
  private lyricWindow: BrowserWindow | null = null;
  private readonly iconPath: string;
  private readonly getMainWindow: () => BrowserWindow | null;
  private readonly onStateChanged?: () => void;
  private registered = false;
  private snapshot: DesktopLyricSnapshot;

  constructor(options: DesktopLyricManagerOptions) {
    this.iconPath = options.iconPath;
    this.getMainWindow = options.getMainWindow;
    this.onStateChanged = options.onStateChanged;
    this.snapshot = {
      song: null,
      lyrics: { type: "lrc", lines: [] },
      currentTime: 0,
      isPlaying: false,
      style: this.readStyle(),
      locked: false,
      visible: false,
    };
  }

  setupIpc() {
    if (this.registered) return;
    this.registered = true;

    ipcMain.handle("desktop-lyric:open", () => {
      this.open();
      return this.snapshot;
    });

    ipcMain.handle("desktop-lyric:close", () => {
      this.close();
      return true;
    });

    ipcMain.handle("desktop-lyric:toggle", () => {
      if (this.isVisible()) {
        this.close();
      } else {
        this.open();
      }
      return this.snapshot;
    });

    ipcMain.handle("desktop-lyric:get-snapshot", () => this.snapshot);
    ipcMain.handle("desktop-lyric:get-bounds", () => this.getBounds());
    ipcMain.handle("desktop-lyric:get-screen-size", () => this.getScreenSize());

    ipcMain.on("desktop-lyric:update-song", (_event, song: unknown | null) => {
      this.updateSong(song);
    });

    ipcMain.on("desktop-lyric:update-playing", (_event, isPlaying: boolean) => {
      this.updatePlaying(isPlaying);
    });

    ipcMain.on("desktop-lyric:update-time", (_event, time: number) => {
      this.updateTime(time);
    });

    ipcMain.on(
      "desktop-lyric:set-lyrics",
      (_event, lyric: { type: "krc" | "lrc"; data?: string; lines?: unknown[] }) => {
        this.setLyrics(lyric);
      }
    );

    ipcMain.on("desktop-lyric:set-style", (_event, style: DesktopLyricStyle) => {
      this.setStyle(style);
    });

    ipcMain.on("desktop-lyric:set-locked", (_event, locked: boolean) => {
      this.setLocked(locked);
    });

    ipcMain.on(
      "desktop-lyric:move",
      (_event, x: number, y: number, width: number, height: number) => {
        this.move(x, y, width, height);
      }
    );

    ipcMain.on("desktop-lyric:ready", () => {
      this.pushSnapshot();
    });

    ipcMain.on("desktop-lyric:control", (_event, action: PlayerAction) => {
      this.handleLyricControl(action);
    });
  }

  open() {
    if (this.lyricWindow && !this.lyricWindow.isDestroyed()) {
      this.lyricWindow.showInactive();
      this.pushSnapshot();
      this.notifyStatus(true);
      return;
    }

    const config = appStore.get("lyricConfig");
    this.snapshot.style = this.readStyle();
    this.snapshot.visible = true;
    appStore.set("lyricConfig.desktop", true);

    this.lyricWindow = new BrowserWindow({
      title: "PisaMusic 桌面歌词",
      icon: this.iconPath,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      fullscreenable: false,
      resizable: true,
      show: false,
      width: config.width || 800,
      height: config.height || 120,
      minWidth: config.minWidth || 500,
      minHeight: config.minHeight || 100,
      maxWidth: config.maxWidth || 1600,
      maxHeight: config.maxHeight || 200,
      x: config.x || 100,
      y: config.y || 100,
      webPreferences: {
        sandbox: false,
        webSecurity: false,
        allowRunningInsecureContent: true,
        spellcheck: false,
        nodeIntegration: true,
        contextIsolation: false,
      },
    } satisfies BrowserWindowConstructorOptions);

    this.lyricWindow.setAlwaysOnTop(true, "screen-saver");
    this.lyricWindow.setSkipTaskbar(true);
    this.applyMouseLock(this.snapshot.locked);

    this.lyricWindow.once("ready-to-show", () => {
      this.lyricWindow?.showInactive();
      this.pushSnapshot();
      this.notifyStatus(true);
    });

    this.lyricWindow.on("closed", () => {
      this.lyricWindow = null;
      this.snapshot.visible = false;
      appStore.set("lyricConfig.desktop", false);
      this.notifyStatus(false);
      this.notifyStateChanged();
    });

    this.lyricWindow.on("resize", () => {
      if (!this.lyricWindow || this.lyricWindow.isDestroyed()) return;
      const bounds = this.lyricWindow.getBounds();
      appStore.set("lyricConfig", {
        ...appStore.get("lyricConfig"),
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
      });
      this.getMainWindow()?.webContents.send("desktop-lyric:bounds-changed", {
        width: bounds.width,
        height: bounds.height,
      });
    });

    this.lyricWindow
      .loadFile(path.join(__dirname, "./web/lyric-window.html"))
      .catch((error) => {
        logger.error("load desktop lyric window failed", {
          message: error?.message,
          stack: error?.stack,
        });
      });
  }

  toggle() {
    if (this.isVisible()) {
      this.close();
    } else {
      this.open();
    }
  }

  close() {
    if (this.lyricWindow && !this.lyricWindow.isDestroyed()) {
      this.snapshot.visible = false;
      appStore.set("lyricConfig.desktop", false);
      this.notifyStatus(false);
      this.lyricWindow.close();
      return;
    }
    this.snapshot.visible = false;
    appStore.set("lyricConfig.desktop", false);
    this.notifyStatus(false);
  }

  destroy() {
    this.snapshot.visible = false;
    this.notifyStateChanged();
    if (this.lyricWindow && !this.lyricWindow.isDestroyed()) {
      const win = this.lyricWindow;
      this.lyricWindow = null;
      win.close();
    }
  }

  updateSong(song: unknown | null) {
    this.snapshot.song = song;
    this.pushSnapshot();
  }

  updatePlaying(isPlaying: boolean) {
    this.snapshot.isPlaying = isPlaying;
    this.sendToWindow(isPlaying ? "desktop-lyric:play" : "desktop-lyric:pause");
  }

  updateTime(time: number) {
    this.snapshot.currentTime = normalizeTimeToMs(time);
    this.sendToWindow("desktop-lyric:update-time", this.snapshot.currentTime);
  }

  setLyrics(lyric: { type: "krc" | "lrc"; data?: string; lines?: unknown[] }) {
    this.snapshot.lyrics = {
      type: lyric.type,
      lines: normalizeLyricLines(lyric),
    };
    this.sendToWindow("desktop-lyric:set-lyrics", this.snapshot.lyrics);
  }

  setStyle(style: DesktopLyricStyle) {
    const prev = this.snapshot.style;
    this.snapshot.style = {
      ...this.snapshot.style,
      ...style,
    };
    appStore.set("lyricConfig", {
      ...appStore.get("lyricConfig"),
      ...this.snapshot.style,
    });
    if (
      this.lyricWindow &&
      !this.lyricWindow.isDestroyed() &&
      (style.width !== prev.width || style.height !== prev.height)
    ) {
      this.lyricWindow.setSize(style.width, style.height);
    }
    this.sendToWindow("desktop-lyric:set-style", this.snapshot.style);
  }

  setLocked(locked: boolean) {
    this.snapshot.locked = locked;
    appStore.set("lyricConfig.locked", locked);
    this.applyMouseLock(locked);
    this.sendToWindow("desktop-lyric:set-locked", locked);
    this.getMainWindow()?.webContents.send("desktop-lyric:locked-status", locked);
    this.notifyStateChanged();
  }

  isVisible() {
    return Boolean(this.lyricWindow && !this.lyricWindow.isDestroyed() && this.lyricWindow.isVisible());
  }

  isLocked() {
    return this.snapshot.locked;
  }

  private move(x: number, y: number, width: number, height: number) {
    if (!this.lyricWindow || this.lyricWindow.isDestroyed()) return;
    this.lyricWindow.setBounds({ x, y, width, height });
    appStore.set("lyricConfig", {
      ...appStore.get("lyricConfig"),
      x,
      y,
      width,
      height,
    });
    this.lyricWindow.setAlwaysOnTop(true, "screen-saver");
  }

  private getBounds() {
    if (!this.lyricWindow || this.lyricWindow.isDestroyed()) return null;
    return this.lyricWindow.getBounds();
  }

  private getScreenSize() {
    const overlayTaskbar = appStore.get("lyricConfig.overlayTaskbar");
    const display = screen.getPrimaryDisplay();
    if (overlayTaskbar) {
      return { width: display.size.width, height: display.size.height };
    }
    return { width: display.workAreaSize.width, height: display.workAreaSize.height };
  }

  private handleLyricControl(action: PlayerAction) {
    if (action === "close") {
      this.close();
      return;
    }
    this.getMainWindow()?.webContents.send("media-control", action);
  }

  private pushSnapshot() {
    this.sendToWindow("desktop-lyric:snapshot", this.snapshot);
  }

  private sendToWindow(channel: string, ...args: unknown[]) {
    if (!this.lyricWindow || this.lyricWindow.isDestroyed()) return;
    if (this.lyricWindow.webContents.isDestroyed()) return;
    this.lyricWindow.webContents.send(channel, ...args);
  }

  private notifyStatus(status: boolean) {
    this.getMainWindow()?.webContents.send("desktop-lyric:status", status);
    this.notifyStateChanged();
  }

  private notifyStateChanged() {
    this.onStateChanged?.();
  }

  private applyMouseLock(locked: boolean) {
    if (!this.lyricWindow || this.lyricWindow.isDestroyed()) return;
    if (locked) {
      this.lyricWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      this.lyricWindow.setIgnoreMouseEvents(false);
    }
  }

  private readStyle(): DesktopLyricStyle {
    const config = appStore.get("lyricConfig");
    return {
      width: config.width,
      height: config.height,
      overlayTaskbar: config.overlayTaskbar,
      autoFontSize: config.autoFontSize,
      maxSize: config.maxSize,
      minSize: config.minSize,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      textColor: config.textColor,
      highlightColor: config.highlightColor,
      fontWeight: config.fontWeight,
    };
  }
}

function normalizeTimeToMs(time: number) {
  if (!Number.isFinite(time)) return 0;
  return time > 1000 ? Math.floor(time) : Math.floor(time * 1000);
}

function normalizeLyricLines(lyric: { data?: string; lines?: unknown[] }) {
  if (Array.isArray(lyric.lines)) return lyric.lines;
  if (!lyric.data) return [];
  try {
    const parsed = JSON.parse(lyric.data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
