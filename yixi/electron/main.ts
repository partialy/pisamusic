import { app, BrowserWindow, dialog, ipcMain } from "electron";
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
import { setupDialogIpc } from "./ipc/dialogIpc";
import { setupDebugIpc } from "./ipc/debugIpc";
import { setupLocalLibraryIpc } from "./ipc/localLibraryIpc";
import { setupCookieIpc } from "./ipc/cookieIpc";
import { setupDownloadIpc } from "./ipc/downloadIpc";
import { setupShortcutIpc } from "./ipc/shortcutIpc";
import { setupSyncIpc } from "./ipc/syncIpc";
import { refreshKgCookieIfNeeded } from "./cookie/cookieService";
import { startLocalLibrarySmartScan } from "./localLibrary/localLibraryService";
import { StartupWindowManager } from "./startup/startupWindowManager";
import { startSyncOnStartup } from "./sync/syncService";
import { prepareStartupServiceState } from "./system/systemClient";
import { setupUpdaterIpc, startUpdaterOnStartup } from "./updater/updaterService";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const preloadPath = join(currentDir, "../preload", "index.cjs");
const iconPath = join(currentDir, "../../public/pisamusic_icon_1024.png");
const trayIconDir = join(currentDir, "../../public/tray");

let mainWindow: BrowserWindow | null = null;
let desktopLyric: DesktopLyricManager;
let playerTray: PlayerTray;
let startupWindow: StartupWindowManager;
let isQuitting = false;
let mainWindowReadyToShow = false;
let rendererReady = false;
let startupCompleted = false;
let appRuntimeStarted = false;

function createMainWindow() {
  if (mainWindow) return mainWindow;
  mainWindowReadyToShow = false;
  rendererReady = false;
  startupCompleted = false;

  mainWindow = new BrowserWindow({
    title: "PisaMusic",
    icon: iconPath,
    minWidth: 1200,
    minHeight: 800,
    frame: false,
    show: false,
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

  mainWindow.once("ready-to-show", () => {
    mainWindowReadyToShow = true;
    revealMainWindowIfReady();
  });

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
    mainWindowReadyToShow = false;
    rendererReady = false;
    startupCompleted = false;
  });

  mainWindow.on("close", () => {
    if (!isQuitting) {
      isQuitting = true;
      desktopLyric?.destroy();
      playerTray?.destroy();
      startupWindow?.destroy();
      app.quit();
    }
  });

  return mainWindow;
}

function setupAppIpc() {
  setupWindowIpc(() => mainWindow);
  setupLogIpc();
  setupSystemIpc();
  setupMusicApiIpc();
  setupPersistenceIpc();
  setupUtilsIpc();
  setupDialogIpc();
  setupDebugIpc();
  setupLocalLibraryIpc();
  setupCookieIpc();
  setupDownloadIpc();
  setupShortcutIpc(() => mainWindow);
  setupSyncIpc();
  setupUpdaterIpc(() => mainWindow);
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

function setupStartupBridge() {
  ipcMain.on("startup:renderer-ready", () => {
    rendererReady = true;
    revealMainWindowIfReady();
    void startUpdaterOnStartup(() => mainWindow);
  });
}

async function launchAppRuntime() {
  if (appRuntimeStarted) return;
  appRuntimeStarted = true;
  startupWindow.showLoading();
  try {
    await prepareStartupServiceState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "当前设备不可用";
    dialog.showErrorBox("PisaMusic", message);
    quitApplication();
    return;
  }
  createMainWindow();
  playerTray.create();
  void refreshKgCookieIfNeeded("startup");
  startLocalLibrarySmartScan();
  startSyncOnStartup();
}

function revealMainWindowIfReady() {
  if (startupCompleted || !mainWindow || !mainWindowReadyToShow || !rendererReady) return;
  startupCompleted = true;
  startupWindow.close();
  mainWindow.show();
  mainWindow.focus();
}

function quitApplication() {
  if (isQuitting) return;
  isQuitting = true;
  startupWindow?.destroy();
  desktopLyric?.destroy();
  playerTray?.destroy();
  app.quit();
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
  startupWindow = new StartupWindowManager({
    htmlPath: join(currentDir, "./web/startup-window.html"),
    iconPath,
    onAccepted: () => void launchAppRuntime(),
    onRejected: quitApplication,
  });

  setupAppIpc();
  setupPlayerStateBridge();
  setupStartupBridge();
  startupWindow.setupIpc();

  if (startupWindow.hasAcceptedAgreement()) {
    startupWindow.open("loading");
    void launchAppRuntime();
  } else {
    startupWindow.open("agreement");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  startupWindow?.destroy();
  desktopLyric?.destroy();
  playerTray?.destroy();
  closeAppDatabase();
});

app.on("activate", () => {
  if (mainWindow !== null || isQuitting) return;
  if (startupWindow?.hasAcceptedAgreement()) {
    void launchAppRuntime();
  } else {
    startupWindow?.open("agreement");
  }
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
