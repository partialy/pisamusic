import {
  BrowserWindow,
  ipcMain,
  screen,
  type BrowserWindowConstructorOptions,
} from "electron";
import path from "path";
import { logger } from "../utils/logger";
import { resolveRestoredBounds } from "./desktopLyricBounds";
import {
  getDefaultDesktopLyricSettingRepository,
  type DesktopLyricSettingRepository,
} from "./desktopLyricSettingRepository";
import type {
  DesktopLyricBounds,
  DesktopLyricClockSync,
  DesktopLyricControlAction,
  DesktopLyricLine,
  DesktopLyricPayload,
  DesktopLyricSettingV2,
  DesktopLyricSnapshot,
} from "../../src/types/desktopLyric";

const BOUNDS_SAVE_DELAY_MS = 180;

export interface DesktopLyricManagerOptions {
  iconPath: string;
  lyricPreloadPath?: string;
  getMainWindow: () => BrowserWindow | null;
  settingRepository?: DesktopLyricSettingRepository;
  onStateChanged?: () => void;
}

export class DesktopLyricManager {
  private lyricWindow: BrowserWindow | null = null;
  private readonly iconPath: string;
  private readonly lyricPreloadPath: string;
  private readonly getMainWindow: () => BrowserWindow | null;
  private readonly onStateChanged?: () => void;
  private readonly repository: DesktopLyricSettingRepository;
  private registered = false;

  private pendingBoundsSave: DesktopLyricBounds | null = null;
  private boundsSaveTimer: ReturnType<typeof setTimeout> | null = null;

  private currentLyric: DesktopLyricPayload = {
    kind: "line",
    lines: [],
  };

  private currentClock: DesktopLyricClockSync = {
    positionMs: 0,
    isPlaying: false,
    discontinuity: false,
  };

  private currentSetting: DesktopLyricSettingV2;

  constructor(options: DesktopLyricManagerOptions) {
    this.iconPath = options.iconPath;
    this.getMainWindow = options.getMainWindow;
    this.onStateChanged = options.onStateChanged;
    this.repository = options.settingRepository ?? getDefaultDesktopLyricSettingRepository();
    this.lyricPreloadPath =
      options.lyricPreloadPath ?? path.join(__dirname, "../preload/desktop-lyric.cjs");
    this.currentSetting = this.repository.read();
  }

  setupIpc() {
    if (this.registered) return;
    this.registered = true;

    ipcMain.handle("desktop-lyric:open", () => this.open());
    ipcMain.handle("desktop-lyric:close", () => this.close());
    ipcMain.handle("desktop-lyric:toggle", () => this.toggle());
    ipcMain.handle("desktop-lyric:get-snapshot", () => this.getSnapshot());
    ipcMain.handle("desktop-lyric:get-bounds", () => this.getBounds());

    ipcMain.on("desktop-lyric:update-playing", (_event, isPlaying: boolean) => {
      this.syncClock({
        positionMs: this.currentClock.positionMs,
        isPlaying: Boolean(isPlaying),
        discontinuity: false,
      });
    });

    ipcMain.on("desktop-lyric:update-time", (_event, time: number) => {
      const positionMs = !Number.isFinite(time)
        ? 0
        : time > 1000
          ? Math.floor(time)
          : Math.floor(time * 1000);
      this.syncClock({
        positionMs,
        isPlaying: this.currentClock.isPlaying,
        discontinuity: false,
      });
    });

    ipcMain.on("desktop-lyric:sync-clock", (_event, clock: DesktopLyricClockSync) => {
      this.syncClock(clock);
    });

    ipcMain.on("desktop-lyric:set-lyrics", (_event, payload: unknown) => {
      this.setLyrics(payload);
    });

    ipcMain.on("desktop-lyric:set-style", (_event, style: unknown) => {
      this.patchSetting(style as Partial<DesktopLyricSettingV2>);
    });

    ipcMain.on("desktop-lyric:set-locked", (_event, locked: boolean) => {
      this.setLocked(Boolean(locked));
    });

    ipcMain.on(
      "desktop-lyric:move",
      (_event, x: number, y: number, width: number, height: number) => {
        this.requestBounds({ x, y, width, height });
      },
    );

    ipcMain.on("desktop-lyric:ready", (event) => {
      if (this.isLyricWindowSender(event.sender)) {
        this.pushSnapshot();
      } else {
        this.pushSnapshot();
      }
    });

    ipcMain.on("desktop-lyric:control", (event, action: DesktopLyricControlAction) => {
      if (this.isLyricWindowSender(event.sender) || !this.lyricWindow) {
        this.handleControl(action);
      }
    });

    // New Window-specific IPC channels (Task 4 forward-compatibility)
    ipcMain.on("desktop-lyric-window:ready", (event) => {
      if (this.isLyricWindowSender(event.sender)) {
        this.pushSnapshot();
      }
    });

    ipcMain.on(
      "desktop-lyric-window:control",
      (event, action: DesktopLyricControlAction) => {
        if (this.isLyricWindowSender(event.sender)) {
          this.handleControl(action);
        }
      },
    );

    ipcMain.on("desktop-lyric-window:set-locked", (event, locked: boolean) => {
      if (this.isLyricWindowSender(event.sender)) {
        this.setLocked(Boolean(locked));
      }
    });

    ipcMain.on(
      "desktop-lyric-window:request-bounds",
      (event, bounds: DesktopLyricBounds) => {
        if (this.isLyricWindowSender(event.sender)) {
          this.requestBounds(bounds);
        }
      },
    );
  }

  private isLyricWindowSender(sender: Electron.WebContents): boolean {
    if (!this.lyricWindow || this.lyricWindow.isDestroyed()) return false;
    return this.lyricWindow.webContents.id === sender.id;
  }

  restoreIfEnabled() {
    this.currentSetting = this.repository.read();
    if (this.currentSetting.enabled) {
      this.open();
    }
  }

  open() {
    if (this.isVisible()) {
      this.lyricWindow?.showInactive();
      this.pushSnapshot();
      this.notifyStatus(true);
      return;
    }

    this.currentSetting = this.repository.patch({ enabled: true });

    const primaryDisplayId = screen.getPrimaryDisplay().id;
    const displays = screen.getAllDisplays().map((d) => ({
      bounds: d.bounds,
      workArea: d.workArea,
      isPrimary: d.id === primaryDisplayId,
    }));

    const restoredBounds = resolveRestoredBounds(
      this.currentSetting.bounds,
      displays,
      this.currentSetting.overlayTaskbar,
    );

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
      x: restoredBounds.x,
      y: restoredBounds.y,
      width: restoredBounds.width,
      height: restoredBounds.height,
      minWidth: 500,
      minHeight: 100,
      maxWidth: 1600,
      maxHeight: 200,
      webPreferences: {
        preload: this.lyricPreloadPath,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: false,
        nodeIntegration: false,
        contextIsolation: true,
      },
    } satisfies BrowserWindowConstructorOptions);

    this.lyricWindow.setAlwaysOnTop(true, "screen-saver");
    this.lyricWindow.setSkipTaskbar(true);
    this.applyMouseLock(this.currentSetting.locked);

    this.lyricWindow.once("ready-to-show", () => {
      this.lyricWindow?.showInactive();
      this.pushSnapshot();
      this.notifyStatus(true);
    });

    this.lyricWindow.on("closed", () => {
      this.flushBoundsSave();
      this.lyricWindow = null;
      this.repository.patch({ enabled: false });
      this.currentSetting.enabled = false;
      this.notifyStatus(false);
      this.notifyStateChanged();
    });

    this.lyricWindow.on("resize", () => {
      if (!this.lyricWindow || this.lyricWindow.isDestroyed()) return;
      const bounds = this.lyricWindow.getBounds();
      this.scheduleBoundsSave(bounds);
      this.getMainWindow()?.webContents.send("desktop-lyric:bounds-changed", {
        width: bounds.width,
        height: bounds.height,
      });
    });

    this.lyricWindow.on("move", () => {
      if (!this.lyricWindow || this.lyricWindow.isDestroyed()) return;
      const bounds = this.lyricWindow.getBounds();
      this.scheduleBoundsSave(bounds);
    });

    const lyricHtmlPath = path.join(__dirname, "./web/lyric-window.html");
    this.lyricWindow.loadFile(lyricHtmlPath).catch((error) => {
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
      this.flushBoundsSave();
      this.repository.patch({ enabled: false });
      this.currentSetting.enabled = false;
      this.notifyStatus(false);
      this.lyricWindow.close();
      return;
    }
    this.repository.patch({ enabled: false });
    this.currentSetting.enabled = false;
    this.notifyStatus(false);
  }

  destroy() {
    this.flushBoundsSave();
    this.notifyStateChanged();
    if (this.lyricWindow && !this.lyricWindow.isDestroyed()) {
      const win = this.lyricWindow;
      this.lyricWindow = null;
      win.close();
    }
  }

  isVisible(): boolean {
    return Boolean(
      this.lyricWindow && !this.lyricWindow.isDestroyed() && this.lyricWindow.isVisible(),
    );
  }

  isLocked(): boolean {
    return this.currentSetting.locked;
  }

  setLocked(locked: boolean) {
    this.currentSetting = this.repository.patch({ locked });
    this.applyMouseLock(locked);
    this.sendToWindow("desktop-lyric:set-locked", locked);
    this.sendToWindow("desktop-lyric-window:setting", this.currentSetting);
    this.getMainWindow()?.webContents.send("desktop-lyric:locked-status", locked);
    this.notifyStateChanged();
  }

  patchSetting(patch: Partial<DesktopLyricSettingV2>) {
    const prev = this.currentSetting;
    this.currentSetting = this.repository.patch(patch);

    if (
      this.lyricWindow &&
      !this.lyricWindow.isDestroyed() &&
      this.currentSetting.bounds &&
      (this.currentSetting.bounds.width !== prev.bounds.width ||
        this.currentSetting.bounds.height !== prev.bounds.height)
    ) {
      this.lyricWindow.setSize(
        this.currentSetting.bounds.width,
        this.currentSetting.bounds.height,
      );
    }

    if (patch.locked !== undefined && patch.locked !== prev.locked) {
      this.applyMouseLock(this.currentSetting.locked);
    }

    this.sendToWindow("desktop-lyric:set-style", this.currentSetting);
    this.sendToWindow("desktop-lyric-window:setting", this.currentSetting);
    this.notifyStateChanged();
  }

  setLyrics(payload: unknown) {
    if (!payload || typeof payload !== "object") {
      this.currentLyric = { kind: "line", lines: [] };
    } else {
      const raw = payload as Record<string, unknown>;
      if (Array.isArray(raw.lines)) {
        this.currentLyric = {
          kind: raw.kind === "word" ? "word" : "line",
          lines: raw.lines as DesktopLyricLine[],
        };
      } else if (raw.type && typeof raw.data === "string") {
        // Legacy payload { type: "krc" | "lrc", data: string }
        try {
          const parsed = JSON.parse(raw.data);
          this.currentLyric = {
            kind: raw.type === "krc" ? "word" : "line",
            lines: Array.isArray(parsed) ? (parsed as DesktopLyricLine[]) : [],
          };
        } catch {
          this.currentLyric = { kind: "line", lines: [] };
        }
      } else {
        this.currentLyric = { kind: "line", lines: [] };
      }
    }
    this.sendToWindow("desktop-lyric:set-lyrics", this.currentLyric);
    this.sendToWindow("desktop-lyric-window:lyric", this.currentLyric);
  }

  updateSong(song: unknown | null) {
    this.sendToWindow("desktop-lyric:update-song", song);
  }

  updatePlaying(isPlaying: boolean) {
    this.syncClock({
      positionMs: this.currentClock.positionMs,
      isPlaying: Boolean(isPlaying),
      discontinuity: false,
    });
  }

  updateTime(time: number) {
    const positionMs = !Number.isFinite(time)
      ? 0
      : time > 1000
        ? Math.floor(time)
        : Math.floor(time * 1000);
    this.syncClock({
      positionMs,
      isPlaying: this.currentClock.isPlaying,
      discontinuity: false,
    });
  }

  syncClock(clock: DesktopLyricClockSync) {
    this.currentClock = { ...clock };
    this.sendToWindow("desktop-lyric:update-time", clock.positionMs);
    this.sendToWindow(
      clock.isPlaying ? "desktop-lyric:play" : "desktop-lyric:pause",
    );
    this.sendToWindow("desktop-lyric-window:clock", this.currentClock);
  }

  requestBounds(requested: DesktopLyricBounds) {
    if (!this.lyricWindow || this.lyricWindow.isDestroyed()) return;

    const primaryDisplayId = screen.getPrimaryDisplay().id;
    const displays = screen.getAllDisplays().map((d) => ({
      bounds: d.bounds,
      workArea: d.workArea,
      isPrimary: d.id === primaryDisplayId,
    }));

    const current = this.lyricWindow.getBounds();
    const candidate: DesktopLyricBounds = {
      x: typeof requested.x === "number" ? requested.x : current.x,
      y: typeof requested.y === "number" ? requested.y : current.y,
      width:
        typeof requested.width === "number" && requested.width > 0
          ? requested.width
          : current.width,
      height:
        typeof requested.height === "number" && requested.height > 0
          ? requested.height
          : current.height,
    };

    const constrained = resolveRestoredBounds(
      candidate,
      displays,
      this.currentSetting.overlayTaskbar,
    );

    const sizeChanged =
      constrained.width !== current.width || constrained.height !== current.height;
    const posChanged =
      constrained.x !== current.x || constrained.y !== current.y;

    if (sizeChanged && posChanged) {
      this.lyricWindow.setBounds(constrained);
      this.scheduleBoundsSave(constrained);
    } else if (sizeChanged) {
      this.lyricWindow.setSize(constrained.width, constrained.height);
      this.scheduleBoundsSave({
        ...current,
        width: constrained.width,
        height: constrained.height,
      });
    } else if (posChanged) {
      this.lyricWindow.setPosition(constrained.x, constrained.y);
      this.scheduleBoundsSave({
        ...current,
        x: constrained.x,
        y: constrained.y,
      });
    }
  }

  getBounds(): DesktopLyricBounds | null {
    if (!this.lyricWindow || this.lyricWindow.isDestroyed()) {
      return this.currentSetting.bounds;
    }
    const b = this.lyricWindow.getBounds();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  getSnapshot(): DesktopLyricSnapshot {
    return {
      visible: this.isVisible(),
      lyric: this.currentLyric,
      clock: this.currentClock,
      setting: this.currentSetting,
    };
  }

  private scheduleBoundsSave(bounds: DesktopLyricBounds) {
    this.pendingBoundsSave = { ...bounds };
    if (this.boundsSaveTimer !== null) {
      clearTimeout(this.boundsSaveTimer);
    }
    this.boundsSaveTimer = setTimeout(() => {
      this.flushBoundsSave();
    }, BOUNDS_SAVE_DELAY_MS);
  }

  private flushBoundsSave() {
    if (this.boundsSaveTimer !== null) {
      clearTimeout(this.boundsSaveTimer);
      this.boundsSaveTimer = null;
    }
    if (!this.pendingBoundsSave) return;
    const bounds = this.pendingBoundsSave;
    this.pendingBoundsSave = null;
    this.currentSetting = this.repository.saveBounds(bounds);
  }

  private handleControl(action: DesktopLyricControlAction) {
    if (action === "close") {
      this.close();
      return;
    }
    this.getMainWindow()?.webContents.send("media-control", action);
  }

  private pushSnapshot() {
    const snapshot = this.getSnapshot();
    this.sendToWindow("desktop-lyric:snapshot", snapshot);
    this.sendToWindow("desktop-lyric-window:snapshot", snapshot);
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
}
