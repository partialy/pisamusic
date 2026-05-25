import { app, BrowserWindow, Menu, nativeImage, nativeTheme, Tray } from "electron";
import path from "path";
import { getAppDatabase } from "../database";
import { recordFavoriteSongChange } from "../sync/syncService";

type TrayTrack = {
  id: string;
  name: string;
  singer: string;
  source: string;
  duration?: number;
  cover?: string;
  album?: string;
};

type PlayerTrayOptions = {
  iconPath: string;
  trayIconDir: string;
  getMainWindow: () => BrowserWindow | null;
  onToggleDesktopLyric: () => void;
  isDesktopLyricVisible: () => boolean;
  onToggleDesktopLyricLock: () => void;
  isDesktopLyricLocked: () => boolean;
};

export class PlayerTray {
  private tray: Tray | null = null;
  private currentSong: TrayTrack | null = null;
  private isPlaying = false;
  private readonly iconPath: string;
  private readonly trayIconDir: string;
  private readonly getMainWindow: () => BrowserWindow | null;
  private readonly onToggleDesktopLyric: () => void;
  private readonly isDesktopLyricVisible: () => boolean;
  private readonly onToggleDesktopLyricLock: () => void;
  private readonly isDesktopLyricLocked: () => boolean;

  constructor(options: PlayerTrayOptions) {
    this.iconPath = options.iconPath;
    this.trayIconDir = options.trayIconDir;
    this.getMainWindow = options.getMainWindow;
    this.onToggleDesktopLyric = options.onToggleDesktopLyric;
    this.isDesktopLyricVisible = options.isDesktopLyricVisible;
    this.onToggleDesktopLyricLock = options.onToggleDesktopLyricLock;
    this.isDesktopLyricLocked = options.isDesktopLyricLocked;
  }

  create() {
    this.tray = new Tray(nativeImage.createFromPath(this.iconPath).resize({ width: 16, height: 16 }));
    this.tray.on("click", () => {
      const win = this.getMainWindow();
      if (!win) return;
      win.show();
      win.focus();
    });
    this.refresh();
  }

  setCurrentSong(song: TrayTrack | null) {
    this.currentSong = song;
    this.refresh();
  }

  setPlaying(isPlaying: boolean) {
    this.isPlaying = isPlaying;
    this.refresh();
  }

  destroy() {
    this.tray?.destroy();
    this.tray = null;
  }

  refresh() {
    if (!this.tray) return;

    const currentCollected = this.isCurrentSongFavorite();
    const playingText = this.currentSong
      ? truncateText(`${this.currentSong.name} - ${this.currentSong.singer}`, 20)
      : "PisaMusic";
    const tooltip = this.isPlaying && this.currentSong
      ? `${this.currentSong.name} - ${this.currentSong.singer}`
      : "PisaMusic";

    const contextMenu = Menu.buildFromTemplate([
      {
        label: playingText,
        icon: this.getTrayIcon("music"),
        click: () => {
          const win = this.getMainWindow();
          win?.show();
          win?.focus();
        },
      },
      {
        label: currentCollected ? "取消收藏" : "加入收藏",
        icon: this.getTrayIcon(currentCollected ? "unlove" : "love"),
        click: () => {
          if (!this.currentSong) return;
          const result = getAppDatabase().toggleFavoriteSong(this.currentSong as any);
          recordFavoriteSongChange(this.currentSong as any, result.collected ? "upsert" : "delete");
          this.notifyFavoritesChanged();
          this.refresh();
        },
      },
      {
        label: "上一曲",
        icon: this.getTrayIcon("prev"),
        click: () => this.sendMediaControl("prev"),
      },
      {
        label: this.isPlaying ? "暂停" : "播放",
        icon: this.getTrayIcon(this.isPlaying ? "pause" : "play"),
        click: () => this.sendMediaControl(this.isPlaying ? "pause" : "play"),
      },
      {
        label: "下一曲",
        icon: this.getTrayIcon("next"),
        click: () => this.sendMediaControl("next"),
      },
      {
        label: "桌面歌词",
        type: "checkbox",
        checked: this.isDesktopLyricVisible(),
        click: () => {
          this.onToggleDesktopLyric();
          setTimeout(() => this.refresh(), 50);
        },
      },
      {
        label: this.isDesktopLyricLocked() ? "解锁歌词" : "锁定歌词",
        icon: this.getTrayIcon(this.isDesktopLyricLocked() ? "unlock" : "lock"),
        enabled: this.isDesktopLyricVisible(),
        click: () => {
          this.onToggleDesktopLyricLock();
          setTimeout(() => this.refresh(), 50);
        },
      },
      { type: "separator" },
      {
        label: "设置",
        icon: this.getTrayIcon("setting"),
        click: () => this.getMainWindow()?.webContents.send("route:settings"),
      },
      {
        label: "退出",
        icon: this.getTrayIcon("power"),
        click: () => app.quit(),
      },
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip(tooltip);
  }

  private sendMediaControl(action: "play" | "pause" | "next" | "prev") {
    this.getMainWindow()?.webContents.send("media-control", action);
  }

  private isCurrentSongFavorite() {
    if (!this.currentSong) return false;
    return getAppDatabase().containsFavoriteSong(this.currentSong.source, this.currentSong.id);
  }

  private notifyFavoritesChanged() {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("favorites:changed");
    });
  }

  private getTrayIcon(name: string) {
    const isDark = nativeTheme.shouldUseDarkColors;
    const filename = `${name}${isDark ? "-dark.png" : "-light.png"}`;
    return nativeImage
      .createFromPath(path.join(this.trayIconDir, filename))
      .resize({ width: 16, height: 16 });
  }
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.substring(0, maxLength)}...`;
}
