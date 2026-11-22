import { shutdownDownloads } from "./download/downloadService";
import { publishPlaybackSong, releasePlaybackSong, commitLocalPlayback, clearLocalPlaybackReservations } from "./download/localPlaybackReservation";
import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { setupEnvironmentUserDataPaths } from "./core/appPaths";

setupEnvironmentUserDataPaths();

import { closeAppDatabase } from "./database";
import { DesktopLyricManager } from "./desktopLyric/desktopLyricManager";
import { setupListenTogetherIpc } from "./ipc/listenTogetherIpc";
import { setupLogIpc } from "./ipc/logIpc";
import { setupMusicApiIpc } from "./ipc/musicIpc";
import { setupPersistenceIpc } from "./ipc/persistenceIpc";
import { setupSystemIpc } from "./ipc/systemIpc";
import { setupDirectMessageIpc } from "./ipc/directMessageIpc";
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
import { setupShareIpc } from "./ipc/shareIpc";
import { setupSyncIpc } from "./ipc/syncIpc";
import { setupMediaCacheIpc } from "./ipc/mediaCacheIpc";
import { setupFaultReportIpc } from "./ipc/faultReportIpc";
import { setupCloudMusicIpc } from "./ipc/cloudMusicIpc";
import { setupListeningIpc } from "./ipc/listeningIpc";
import { getListeningManager } from "./listening";
import { closeListenTogetherSocket } from "./listenTogether/listenTogetherService";
import { ListenTogetherInviteCoordinator } from "./listenTogether/listenTogetherInviteCoordinator";
import { refreshKgCookieIfNeeded } from "./cookie/cookieService";
import { startLocalLibrarySmartScan } from "./localLibrary/localLibraryService";
import { StartupWindowManager } from "./startup/startupWindowManager";
import { startSyncOnStartup } from "./sync/syncService";
import {
  getServiceDiscoverySnapshot,
  initializeServiceDiscovery,
  refreshServiceDiscovery,
} from "./system/serviceDiscovery";
import {
  DesktopDeviceLockedError,
  SystemServiceBlockedError,
  activateLocalMode,
  executeDesktopStartup,
  getStartupServiceState,
  setStartupStateGate,
} from "./system/systemClient";
import { setupUpdaterIpc, startUpdaterOnStartup } from "./updater/updaterService";
import {
  closeMediaCache,
  registerMediaCacheScheme,
  setupMediaCacheProtocol,
} from "./mediaCache";
import {
  disposePlayerControlsIpc,
  setPlayerControlsTrackingSuspended,
  setupPlayerControlsIpc,
} from "./ipc/playerControlsIpc";
import { setupLowPowerIpc } from "./ipc/lowPowerIpc";
import { LowPowerManager } from "./power/lowPowerManager";
import { isWindowIdleForLowPower } from "./power/lowPowerRules";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const preloadPath = join(currentDir, "../preload", "index.cjs");
const iconPath = join(currentDir, "../../public/pisamusic_icon_1024.png");
const trayIconDir = join(currentDir, "../../public/tray");

const STARTUP_LOCAL_MODE_PROMPT_DELAY_MS = 3_000;
const STARTUP_TOTAL_TIMEOUT_MS = 10_000;

let mainWindow: BrowserWindow | null = null;
let desktopLyric: DesktopLyricManager;
let playerTray: PlayerTray;
let startupWindow: StartupWindowManager;
let lowPowerManager: LowPowerManager;
let isQuitting = false;
let mainWindowReadyToShow = false;
let rendererReady = false;
let startupCompleted = false;
let startupSettled = false;
let startupAgreementApproved = false;
let startupBlocked = false;
let postRevealServicesStarted = false;
let startupPromptTimer: NodeJS.Timeout | null = null;
let startupTimeoutTimer: NodeJS.Timeout | null = null;
let startupAbortController: AbortController | null = null;
let resolveStartupGate: (() => void) | null = null;
const inviteCoordinator = new ListenTogetherInviteCoordinator({
  getMainWindow: () => mainWindow,
});

function syncPlayerControlsSuspension(): void {
  const isLowPower = lowPowerManager?.getState().active ?? false;
  const isIdle =
    !mainWindow ||
    isWindowIdleForLowPower({
      destroyed: mainWindow.isDestroyed(),
      visible: mainWindow.isVisible(),
      minimized: mainWindow.isMinimized(),
    });
  setPlayerControlsTrackingSuspended(isLowPower || isIdle);
}

registerMediaCacheScheme();

function createMainWindow() {
  if (mainWindow) return mainWindow;
  mainWindowReadyToShow = false;
  rendererReady = false;
  startupCompleted = false;
  inviteCoordinator.resetRenderer();

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
      backgroundThrottling: true,
    },
  });
  lowPowerManager?.attachMainWindow(mainWindow);
  mainWindow.webContents.on("render-process-gone", clearLocalPlaybackReservations);
  mainWindow.webContents.on("destroyed", clearLocalPlaybackReservations);
  mainWindow.webContents.on("did-start-navigation", (_event, _url, _inPlace, isMainFrame) => {
    if (isMainFrame) clearLocalPlaybackReservations();
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
    inviteCoordinator.resetRenderer();
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
  setupDirectMessageIpc();
  setupMusicApiIpc();
  setupPersistenceIpc();
  setupUtilsIpc();
  setupDialogIpc();
  setupDebugIpc();
  setupLocalLibraryIpc();
  setupCookieIpc();
  setupDownloadIpc();
  setupShortcutIpc(() => mainWindow);
  setupShareIpc();
  setupSyncIpc();
  setupListenTogetherIpc(() => mainWindow);
  setupUpdaterIpc(() => mainWindow);
  setupMediaCacheIpc();
  setupFaultReportIpc();
  setupCloudMusicIpc();
  setupListeningIpc();
  setupPlayerControlsIpc(() => mainWindow);
  setupLowPowerIpc(lowPowerManager);
  desktopLyric.setupIpc();
}

function setupPlayerStateBridge() {
  ipcMain.on("player:set-current-song", (_event, song) => {
    publishPlaybackSong(song);
    playerTray.setCurrentSong(song);
    desktopLyric.updateSong(song);
  });

  ipcMain.on("player:release-local-file", (_event, song) => releasePlaybackSong(song));
  ipcMain.handle("player:commit-local-file", (_event, song) => commitLocalPlayback(song));

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
    inviteCoordinator.markRendererReady();
    revealMainWindowIfReady();
  });
}

function clearStartupTimers() {
  if (startupPromptTimer) {
    clearTimeout(startupPromptTimer);
    startupPromptTimer = null;
  }
  if (startupTimeoutTimer) {
    clearTimeout(startupTimeoutTimer);
    startupTimeoutTimer = null;
  }
}

function resetStartupGate() {
  startupSettled = false;
  startupBlocked = false;
  postRevealServicesStarted = false;
  const gate = new Promise<void>((resolve) => {
    resolveStartupGate = resolve;
  });
  setStartupStateGate(gate);
}

function completeStartupGate() {
  if (startupSettled) return;
  startupSettled = true;
  clearStartupTimers();
  startupWindow?.setLocalModeAvailable(false);
  resolveStartupGate?.();
  resolveStartupGate = null;
}

function enterLocalMode(reason: string) {
  if (startupBlocked || startupSettled || isQuitting) return;
  clearStartupTimers();
  startupAbortController?.abort();
  startupAbortController = null;
  activateLocalMode(reason);
  startupAgreementApproved = true;
  startupWindow?.showLoading();
  completeStartupGate();
  createMainWindow();
  playerTray?.create();
  revealMainWindowIfReady();
}

async function performStartupWithRecovery(signal: AbortSignal) {
  try {
    return await executeDesktopStartup({ signal });
  } catch (error) {
    if (
      signal.aborted ||
      error instanceof SystemServiceBlockedError ||
      error instanceof DesktopDeviceLockedError
    ) {
      throw error;
    }
    // 命中缓存节点失败时强刷一次服务发现并探测健康节点后重试，其余错误向上抛出走降级。
    if (getServiceDiscoverySnapshot().source === "cache") {
      logger.warn("缓存服务端点不可达，强刷服务发现后重试", {
        error: error instanceof Error ? error.message : String(error),
      });
      await refreshServiceDiscovery({ skipHealthProbe: false });
      if (signal.aborted) throw error;
      return await executeDesktopStartup({ signal });
    }
    throw error;
  }
}

function startPostRevealServices() {
  if (postRevealServicesStarted) return;
  postRevealServicesStarted = true;
  void startUpdaterOnStartup(() => mainWindow);
  startLocalLibrarySmartScan();
  if (!getStartupServiceState().localMode) {
    void refreshKgCookieIfNeeded("startup");
    startSyncOnStartup();
  }
}

async function launchAppRuntime() {
  if (isQuitting) return;
  clearStartupTimers();
  startupAbortController?.abort();
  startupWindow.setBlockedMessage("");
  startupWindow.setLocalModeAvailable(false);
  startupBlocked = false;

  const controller = new AbortController();
  startupAbortController = controller;

  startupPromptTimer = setTimeout(() => {
    if (!startupSettled && !startupBlocked && !controller.signal.aborted) {
      startupWindow.setLocalModeAvailable(true);
    }
  }, STARTUP_LOCAL_MODE_PROMPT_DELAY_MS);

  startupTimeoutTimer = setTimeout(() => {
    enterLocalMode("连接服务超时，已切换本地模式");
  }, STARTUP_TOTAL_TIMEOUT_MS);

  // 先解析 SWR 缓存优先的网关快照，再立即并行创建隐藏主窗口与发起桌面聚合启动请求。
  await initializeServiceDiscovery();
  if (controller.signal.aborted || startupSettled) return;

  createMainWindow();
  playerTray.create();

  try {
    const startupResult = await performStartupWithRecovery(controller.signal);
    if (controller.signal.aborted || startupSettled) return;

    clearStartupTimers();
    startupWindow.setLocalModeAvailable(false);

    if (startupResult.agreement.acceptedUpToDate) {
      startupAgreementApproved = true;
      completeStartupGate();
      revealMainWindowIfReady();
      return;
    }

    startupAgreementApproved = false;
    startupWindow.setAgreementContent(startupResult.agreement);
    startupWindow.open("agreement");
  } catch (error) {
    if (controller.signal.aborted || startupSettled) return;

    if (error instanceof SystemServiceBlockedError || error instanceof DesktopDeviceLockedError) {
      startupBlocked = true;
      clearStartupTimers();
      startupWindow.setBlockedMessage(error.message || "当前服务不可用");
      return;
    }

    const message = error instanceof Error ? error.message : "服务连接失败";
    enterLocalMode(`${message}，已切换本地模式`);
  }
}

function revealMainWindowIfReady() {
  if (
    startupCompleted ||
    !startupSettled ||
    !startupAgreementApproved ||
    !mainWindow ||
    !mainWindowReadyToShow ||
    !rendererReady
  ) {
    return;
  }
  startupCompleted = true;
  startupWindow.close();
  mainWindow.show();
  mainWindow.focus();
  desktopLyric?.restoreIfEnabled();
  startPostRevealServices();
}

function focusApplicationWindow() {
  if (lowPowerManager?.getState().active) {
    lowPowerManager.exit({ showWindow: true });
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  startupWindow?.focus();
}

function registerDefaultProtocolClient() {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient("pisamusic", process.execPath, [resolve(process.argv[1])]);
    return;
  }
  app.setAsDefaultProtocolClient("pisamusic");
}

function quitApplication() {
  if (isQuitting) return;
  isQuitting = true;
  clearStartupTimers();
  startupAbortController?.abort();
  startupAbortController = null;
  lowPowerManager?.dispose();
  startupWindow?.destroy();
  desktopLyric?.destroy();
  playerTray?.destroy();
  app.quit();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  registerDefaultProtocolClient();
  inviteCoordinator.captureArguments(process.argv);

  app.on("second-instance", (_event, commandLine) => {
    inviteCoordinator.captureArguments(commandLine);
    focusApplicationWindow();
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    inviteCoordinator.captureUrl(url);
    focusApplicationWindow();
  });

  app.whenReady().then(async () => {
    await setupMediaCacheProtocol();
    desktopLyric = new DesktopLyricManager({
      iconPath,
      getMainWindow: () => mainWindow,
      onStateChanged: () => playerTray?.refresh(),
      onRestoreMainWindow: () => {
        lowPowerManager?.exit({ showWindow: true });
      },
    });
    lowPowerManager = new LowPowerManager({
      getMainWindow: () => mainWindow,
      onLowPowerChanged: (active) => {
        desktopLyric?.setLowPowerActive(active);
        syncPlayerControlsSuspension();
        playerTray?.refresh();
      },
      onWindowActivityChanged: () => {
        syncPlayerControlsSuspension();
      },
    });
    playerTray = new PlayerTray({
      iconPath,
      trayIconDir,
      getMainWindow: () => mainWindow,
      onToggleDesktopLyric: () => desktopLyric.toggle(),
      isDesktopLyricVisible: () => desktopLyric.isVisible(),
      onToggleDesktopLyricLock: () => desktopLyric.setLocked(!desktopLyric.isLocked()),
      isDesktopLyricLocked: () => desktopLyric.isLocked(),
      isLowPowerActive: () => lowPowerManager.getState().active,
      onToggleLowPower: () => {
        lowPowerManager.toggleManual();
      },
      onShowMainWindow: () => {
        focusApplicationWindow();
      },
    });
    startupWindow = new StartupWindowManager({
      htmlPath: join(currentDir, "./web/startup-window.html"),
      iconPath,
      onAccepted: () => {
        startupAgreementApproved = true;
        startupWindow.showLoading();
        completeStartupGate();
        revealMainWindowIfReady();
      },
      onRejected: quitApplication,
      onEnterLocalMode: () => {
        enterLocalMode("已手动切换本地模式进入");
      },
      onRetry: () => {
        if (startupSettled) return;
        startupWindow.showLoading();
        void launchAppRuntime();
      },
    });

    setupAppIpc();
    setupPlayerStateBridge();
    setupStartupBridge();
    startupWindow.setupIpc();

    startupAgreementApproved = startupWindow.hasAcceptedAgreement();
    resetStartupGate();
    startupWindow.open("loading");
    void launchAppRuntime();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  let downloadShutdownStarted = false;
  let downloadShutdownComplete = false;
  app.on("before-quit", (event) => {
    if (!downloadShutdownComplete) {
      event.preventDefault();
      if (downloadShutdownStarted) return;
      downloadShutdownStarted = true;
      isQuitting = true;
      void shutdownDownloads().then((settled) => {
        if (!settled) { app.exit(0); return; } // 异常有界退出不先关 DB；下次启动按检查点恢复。
        downloadShutdownComplete = true;
        app.quit();
      }).catch((error) => { console.error("下载退出检查点失败", error); app.exit(1); });
      return;
    }
    isQuitting = true;
    lowPowerManager?.dispose();
    disposePlayerControlsIpc();
    getListeningManager().shutdown();
    closeListenTogetherSocket();
    closeMediaCache();
    startupWindow?.destroy();
    desktopLyric?.destroy();
    playerTray?.destroy();
    closeAppDatabase();
  });

  app.on("activate", () => {
    if (mainWindow !== null || isQuitting) return;
    startupAgreementApproved = startupWindow?.hasAcceptedAgreement() ?? false;
    resetStartupGate();
    startupWindow?.open("loading");
    void launchAppRuntime();
  });
}

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
