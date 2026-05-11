import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { closeAppDatabase } from "./database";
import { DesktopLyricManager } from "./desktopLyricManager";
import { setupLogIpc } from "./ipc/logIpc";
import { setupMusicApiIpc } from "./ipc/musicIpc";
import { setupPersistenceIpc } from "./ipc/persistenceIpc";
import { setupSystemIpc } from "./ipc/systemIpc";
import { setupWindowIpc } from "./ipc/windowIpc";
import { PlayerTray } from "./tray/playerTray";
import { logger } from "./utils/logger";
import { setupUtilsIpc } from "./ipc/utilsIpc";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const preloadPath = join(currentDir, "../preload", "index.cjs");
const iconPath = join(currentDir, "../../public/pisamusic_icon_1024.png");
const trayIconDir = join(currentDir, "../../public/tray");

let mainWindow: BrowserWindow | null = null;
let desktopLyric: DesktopLyricManager;
let playerTray: PlayerTray;
let isQuitting = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: "PisaMusic",
    icon: iconPath,
    minWidth: 1200,
    minHeight: 800,
    frame: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      devTools: process.env.NODE_ENV === "development",
      sandbox: true,
    },
  });

  if (!app.isPackaged) {
    void mainWindow.loadURL("http://localhost:30000");
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadFile(join(dirname(currentDir), "renderer", "index.html"));
  }

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:maximized");
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:unmaximized");
  });

  mainWindow.on("hide", () => {
    mainWindow?.webContents.send("window:hide");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("close", () => {
    if (!isQuitting) {
      isQuitting = true;
      desktopLyric?.destroy();
      playerTray?.destroy();
      app.quit();
    }
  });
}

function setupAppIpc() {
  setupWindowIpc(() => mainWindow);
  setupLogIpc();
  setupSystemIpc();
  setupMusicApiIpc();
  setupPersistenceIpc();
  setupUtilsIpc();
  desktopLyric.setupIpc();
}

function setupPlayerStateBridge() {
  ipcMain.on("player:set-current-song", (_event, song) => {
    playerTray.setCurrentSong(song);
    desktopLyric.updateSong(song);
  });

  ipcMain.on("player:set-playing", (_event, isPlaying: boolean) => {
    playerTray.setPlaying(isPlaying);
    desktopLyric.updatePlaying(isPlaying);
  });

  ipcMain.on("player:update-time", (_event, time: number) => {
    desktopLyric.updateTime(time);
  });
}

app.whenReady().then(() => {
  desktopLyric = new DesktopLyricManager({
    iconPath,
    getMainWindow: () => mainWindow,
    onStateChanged: () => playerTray?.refresh(),
  });
  playerTray = new PlayerTray({
    iconPath,
    trayIconDir,
    getMainWindow: () => mainWindow,
    onToggleDesktopLyric: () => desktopLyric.toggle(),
    isDesktopLyricVisible: () => desktopLyric.isVisible(),
    onToggleDesktopLyricLock: () => desktopLyric.setLocked(!desktopLyric.isLocked()),
    isDesktopLyricLocked: () => desktopLyric.isLocked(),
  });

  setupAppIpc();
  setupPlayerStateBridge();
  createMainWindow();
  playerTray.create();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  desktopLyric?.destroy();
  playerTray?.destroy();
  closeAppDatabase();
});

app.on("activate", () => {
  if (mainWindow === null) createMainWindow();
});

process.on("uncaughtException", (error) => {
  logger.error("main uncaught exception", {
    message: error.message,
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("main unhandled rejection", {
    reason,
  });
});
