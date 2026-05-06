import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import { IPC_CHANNELS, type TrayPlaybackState } from "@shared/ipc";

let tray: Tray | null = null;
let playbackState: TrayPlaybackState = { isPlaying: false };

export function createAppTray(win: BrowserWindow): Tray {
  const iconPath = path.resolve(process.cwd(), "../pm/icons/pisamusic_icon_1024.png");
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }));
  tray.setToolTip("PisaMusic");
  tray.on("click", () => toggleWindow(win));
  updateTrayMenu(win);
  return tray;
}

export function setTrayPlaybackState(win: BrowserWindow, state: TrayPlaybackState): void {
  playbackState = state;
  updateTrayMenu(win);
}

function updateTrayMenu(win: BrowserWindow): void {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    {
      label: win.isVisible() ? "隐藏 PisaMusic" : "显示 PisaMusic",
      click: () => toggleWindow(win),
    },
    { type: "separator" },
    {
      label: playbackState.isPlaying ? "暂停" : "播放",
      click: () => sendPlayerCommand(win, "toggle-play"),
    },
    {
      label: "上一首",
      click: () => sendPlayerCommand(win, "previous"),
    },
    {
      label: "下一首",
      click: () => sendPlayerCommand(win, "next"),
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(playbackState.title ? `PisaMusic - ${playbackState.title}` : "PisaMusic");
}

function toggleWindow(win: BrowserWindow): void {
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.focus();
  }
  updateTrayMenu(win);
}

function sendPlayerCommand(win: BrowserWindow, command: "toggle-play" | "previous" | "next"): void {
  win.webContents.send(IPC_CHANNELS.playerTrayCommand, command);
}
