import { app, BrowserWindow, ipcMain } from "electron";
import updaterPkg from "electron-updater";
import type { ProgressInfo, UpdateInfo } from "electron-updater";
import { getBootstrap, getStartupServiceState, requestSystem } from "../system/systemClient";
import type { BootstrapConfig } from "../system/types";
import { logger } from "../utils/logger";

const FALLBACK_FEED_BASE_URL = "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64";
const { autoUpdater } = updaterPkg;

type DesktopReleaseInfo = {
  latestVersion: string;
  forceUpdate: boolean;
  updateContent: string;
  updateTime?: string;
  downloadUrl?: string;
  officialUrl?: string;
};

export type UpdaterStatus =
  | "idle"
  | "disabled"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export type UpdaterState = {
  status: UpdaterStatus;
  feedUrl: string;
  updateInfo: UpdateInfo | null;
  progress: ProgressInfo | null;
  forceUpdate: boolean;
  error: string;
  manual: boolean;
  simulated?: boolean;
};

type CheckOptions = {
  manual?: boolean;
};

let registered = false;
let startupTimer: NodeJS.Timeout | null = null;
let currentState: UpdaterState = {
  status: "idle",
  feedUrl: "",
  updateInfo: null,
  progress: null,
  forceUpdate: false,
  error: "",
  manual: false,
  simulated: false,
};

function canUseUpdater() {
  return app.isPackaged && process.platform === "win32" && process.arch === "x64";
}

function emitState(getMainWindow: () => BrowserWindow | null) {
  getMainWindow()?.webContents.send("updater:state", currentState);
}

function setState(getMainWindow: () => BrowserWindow | null, patch: Partial<UpdaterState>) {
  currentState = {
    ...currentState,
    ...patch,
  };
  emitState(getMainWindow);
}

function createSimulatedUpdateInfo(release: DesktopReleaseInfo | null): UpdateInfo {
  const version = release?.latestVersion?.trim() || app.getVersion();
  const releaseNotes = release?.updateContent?.trim() || "开发环境模拟更新";
  const releaseDate = release?.updateTime?.trim() || new Date().toISOString();
  return {
    version,
    releaseName: `PisaMusic ${version}`,
    releaseNotes,
    releaseDate,
    files: [],
    path: release?.downloadUrl || "",
    sha512: "",
  } as UpdateInfo;
}

function normalizeFeedUrl(raw?: string) {
  const value = String(raw ?? "").trim() || FALLBACK_FEED_BASE_URL;
  return value.replace(/\/+$/, "");
}

function resolveDesktopUpdaterConfig(bootstrap: BootstrapConfig | null) {
  const desktop = bootstrap?.updater?.desktop;
  return {
    enabled: desktop?.enabled ?? true,
    feedBaseUrl: normalizeFeedUrl(desktop?.feedBaseUrl),
    checkOnStartup: desktop?.checkOnStartup ?? true,
    startupDelayMs: Number.isFinite(Number(desktop?.startupDelayMs)) ? Math.max(0, Number(desktop?.startupDelayMs)) : 15000,
  };
}

async function getUpdaterBootstrap() {
  try {
    return await getBootstrap();
  } catch {
    return null;
  }
}

async function getDesktopReleaseInfo(): Promise<DesktopReleaseInfo | null> {
  try {
    const response = await requestSystem<Record<string, DesktopReleaseInfo>>("/api/config/releases", { encrypted: false });
    if (!response.success || !response.data?.desktop) return null;
    return response.data.desktop;
  } catch {
    return null;
  }
}

async function prepareFeed(getMainWindow: () => BrowserWindow | null, manual: boolean) {
  if (!canUseUpdater()) {
    setState(getMainWindow, {
      status: "disabled",
      manual,
      error: app.isPackaged ? "当前平台暂不支持自动更新" : "开发模式不检查自动更新",
    });
    return false;
  }
  if (getStartupServiceState().localMode) {
    setState(getMainWindow, {
      status: "disabled",
      manual,
      error: "本地模式不检查自动更新",
    });
    return false;
  }

  const config = resolveDesktopUpdaterConfig(await getUpdaterBootstrap());
  if (!config.enabled) {
    setState(getMainWindow, {
      status: "disabled",
      manual,
      feedUrl: config.feedBaseUrl,
      error: "自动更新已关闭",
    });
    return false;
  }
  autoUpdater.setFeedURL({
    provider: "generic",
    url: config.feedBaseUrl,
  });
  setState(getMainWindow, {
    feedUrl: config.feedBaseUrl,
    manual,
    error: "",
  });
  return true;
}

export function setupUpdaterIpc(getMainWindow: () => BrowserWindow | null) {
  if (registered) return;
  registered = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    setState(getMainWindow, { status: "checking", progress: null, error: "", simulated: false });
  });
  autoUpdater.on("update-available", (info) => {
    void getDesktopReleaseInfo().then((release) => {
      setState(getMainWindow, {
        status: "available",
        updateInfo: info,
        progress: null,
        forceUpdate: Boolean(release?.forceUpdate),
        error: "",
        simulated: false,
      });
    });
  });
  autoUpdater.on("update-not-available", (info) => {
    setState(getMainWindow, { status: "not-available", updateInfo: info, progress: null, forceUpdate: false, error: "", simulated: false });
  });
  autoUpdater.on("download-progress", (progress) => {
    setState(getMainWindow, { status: "downloading", progress, error: "", simulated: false });
  });
  autoUpdater.on("update-downloaded", (info) => {
    setState(getMainWindow, { status: "downloaded", updateInfo: info, progress: null, error: "", simulated: false });
  });
  autoUpdater.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`自动更新失败：${message}`);
    setState(getMainWindow, { status: "error", error: message, progress: null });
  });

  ipcMain.handle("updater:get-state", () => currentState);
  ipcMain.handle("updater:check", async (_event, options?: CheckOptions) => {
    const manual = Boolean(options?.manual);
    if (!(await prepareFeed(getMainWindow, manual))) return currentState;
    await autoUpdater.checkForUpdates();
    return currentState;
  });
  ipcMain.handle("updater:simulate-check", async () => {
    if (app.isPackaged) {
      setState(getMainWindow, {
        status: "disabled",
        manual: true,
        error: "模拟检查更新仅支持开发环境",
        simulated: false,
      });
      return currentState;
    }

    setState(getMainWindow, {
      status: "checking",
      manual: true,
      progress: null,
      error: "",
      simulated: true,
    });
    const release = await getDesktopReleaseInfo();
    setState(getMainWindow, {
      status: "available",
      updateInfo: createSimulatedUpdateInfo(release),
      progress: null,
      forceUpdate: Boolean(release?.forceUpdate),
      error: "",
      manual: true,
      simulated: true,
    });
    return currentState;
  });
  ipcMain.handle("updater:download", async () => {
    if (currentState.status !== "available" || currentState.simulated) return currentState;
    await autoUpdater.downloadUpdate();
    return currentState;
  });
  ipcMain.handle("updater:quit-and-install", () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

export async function startUpdaterOnStartup(getMainWindow: () => BrowserWindow | null) {
  if (startupTimer) return;
  const config = resolveDesktopUpdaterConfig(await getUpdaterBootstrap());
  if (!config.checkOnStartup) return;
  startupTimer = setTimeout(() => {
    void (async () => {
      if (!(await prepareFeed(getMainWindow, false))) return;
      await autoUpdater.checkForUpdates();
    })().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`启动自动检查更新失败：${message}`);
      setState(getMainWindow, { status: "error", error: message, progress: null, manual: false });
    });
  }, config.startupDelayMs);
}
