import { app, BrowserWindow, ipcMain } from "electron";
import updaterPkg from "electron-updater";
import type { ProgressInfo, UpdateInfo } from "electron-updater";
import { getServiceDiscoverySnapshot } from "../system/serviceDiscovery";
import {
  getBootstrap,
  getDesktopReleaseFromStartupSnapshot,
  getStartupServiceState,
  requestSystem,
} from "../system/systemClient";
import type { BootstrapConfig } from "../system/types";
import { logger } from "../utils/logger";
import { resolveUpdaterFeedCandidates } from "./updaterConfig";

const { autoUpdater } = updaterPkg;

type DesktopReleaseInfo = {
  latestVersion: string;
  forceUpdate: boolean;
  updateContent: string;
  updateTime?: string;
  downloadUrl?: string;
  officialUrl?: string;
};

type UpdateHistoryEntry = {
  platform?: string;
  version?: string;
  updateContent?: string;
  forceUpdate?: boolean;
  updateTime?: string;
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
let checkingFallbackFeeds = false;
let updateCheckInFlight: Promise<void> | null = null;
let pendingAvailableTask: Promise<void> | null = null;
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

function resolveDesktopUpdaterConfig(bootstrap: BootstrapConfig | null) {
  const desktop = bootstrap?.updater?.desktop;
  return {
    enabled: desktop?.enabled ?? true,
    bootstrapFeedBaseUrl: desktop?.feedBaseUrl ?? "",
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
  const cachedRelease = getDesktopReleaseFromStartupSnapshot();
  if (cachedRelease) return cachedRelease;
  try {
    const response = await requestSystem<Record<string, DesktopReleaseInfo>>("/api/config/releases", { encrypted: false });
    if (!response.success || !response.data?.desktop) return null;
    return response.data.desktop;
  } catch {
    return null;
  }
}

function normalizeVersionKey(version?: string | null): string {
  return String(version ?? "").trim().replace(/^v/i, "").toLowerCase();
}

function extractRawReleaseNotes(raw: UpdateInfo["releaseNotes"]): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item : String(item?.note ?? "")))
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

async function getDesktopHistoryReleaseByVersion(version: string): Promise<UpdateHistoryEntry | null> {
  const target = String(version ?? "").trim();
  if (!target) return null;
  try {
    const response = await requestSystem<UpdateHistoryEntry>(
      `/api/config/releases/detail?platform=pc&version=${encodeURIComponent(target)}`,
      { encrypted: false },
    );
    if (!response.success || !response.data) return null;
    return response.data;
  } catch {
    return null;
  }
}

async function resolveDesktopReleaseMetadata(info: UpdateInfo): Promise<{
  releaseNotes: string;
  forceUpdate: boolean;
  releaseDate?: string;
}> {
  const release = await getDesktopReleaseInfo();
  const targetVer = normalizeVersionKey(info.version);
  const releaseVer = normalizeVersionKey(release?.latestVersion);

  if (release && (!targetVer || !releaseVer || releaseVer === targetVer)) {
    return {
      releaseNotes: release.updateContent?.trim() || extractRawReleaseNotes(info.releaseNotes),
      forceUpdate: Boolean(release.forceUpdate),
      releaseDate: release.updateTime?.trim() || info.releaseDate,
    };
  }

  const matchedHistory = await getDesktopHistoryReleaseByVersion(info.version);
  if (matchedHistory) {
    return {
      releaseNotes:
        matchedHistory.updateContent?.trim() ||
        release?.updateContent?.trim() ||
        extractRawReleaseNotes(info.releaseNotes),
      forceUpdate: Boolean(matchedHistory.forceUpdate ?? release?.forceUpdate),
      releaseDate: matchedHistory.updateTime?.trim() || info.releaseDate,
    };
  }

  return {
    releaseNotes: release?.updateContent?.trim() || extractRawReleaseNotes(info.releaseNotes),
    forceUpdate: Boolean(release?.forceUpdate),
    releaseDate: release?.updateTime?.trim() || info.releaseDate,
  };
}

function buildUpdateInfoWithNotes(
  info: UpdateInfo,
  releaseNotes: string,
  releaseDate?: string,
): UpdateInfo {
  return {
    ...info,
    releaseNotes: releaseNotes || extractRawReleaseNotes(info.releaseNotes),
    releaseDate: info.releaseDate || releaseDate || "",
  } as UpdateInfo;
}

async function prepareFeeds(getMainWindow: () => BrowserWindow | null, manual: boolean) {
  if (!canUseUpdater()) {
    setState(getMainWindow, {
      status: "disabled",
      manual,
      error: app.isPackaged ? "当前平台暂不支持自动更新" : "开发模式不检查自动更新",
    });
    return false;
  }
  const config = resolveDesktopUpdaterConfig(await getUpdaterBootstrap());
  if (!config.enabled) {
    setState(getMainWindow, {
      status: "disabled",
      manual,
      feedUrl: config.bootstrapFeedBaseUrl.trim(),
      error: "自动更新已关闭",
    });
    return null;
  }
  const discoveryFeeds = getServiceDiscoverySnapshot().updateFeedBaseUrls;
  const feeds = resolveUpdaterFeedCandidates(config.bootstrapFeedBaseUrl, discoveryFeeds);
  return feeds;
}

async function checkForUpdatesWithFallback(
  feeds: string[],
  getMainWindow: () => BrowserWindow | null,
  manual: boolean,
) {
  let lastError: unknown = new Error("没有可用的自动更新地址");
  checkingFallbackFeeds = true;
  try {
    for (const feedUrl of feeds) {
      try {
        autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
        setState(getMainWindow, { feedUrl, manual, error: "" });
        await autoUpdater.checkForUpdates();
        return;
      } catch (error) {
        lastError = error;
        logger.warn(`自动更新源不可用，准备尝试下一个：${feedUrl}`);
      }
    }
    throw lastError;
  } finally {
    checkingFallbackFeeds = false;
  }
}

async function runUpdateCheck(getMainWindow: () => BrowserWindow | null, manual: boolean) {
  try {
    const feeds = await prepareFeeds(getMainWindow, manual);
    if (!feeds) return;
    await checkForUpdatesWithFallback(feeds, getMainWindow, manual);
    if (pendingAvailableTask) await pendingAvailableTask;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`自动检查更新失败：${message}`);
    setState(getMainWindow, { status: "error", error: message, progress: null, manual });
  }
}

function requestUpdateCheck(getMainWindow: () => BrowserWindow | null, manual: boolean) {
  if (updateCheckInFlight) return updateCheckInFlight;
  const task = runUpdateCheck(getMainWindow, manual);
  updateCheckInFlight = task;
  void task.then(
    () => {
      if (updateCheckInFlight === task) updateCheckInFlight = null;
    },
    () => {
      if (updateCheckInFlight === task) updateCheckInFlight = null;
    },
  );
  return task;
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
    const task = resolveDesktopReleaseMetadata(info)
      .then((meta) => {
        setState(getMainWindow, {
          status: "available",
          updateInfo: buildUpdateInfoWithNotes(info, meta.releaseNotes, meta.releaseDate),
          progress: null,
          forceUpdate: meta.forceUpdate,
          error: "",
          simulated: false,
        });
      })
      .catch(() => {
        setState(getMainWindow, {
          status: "available",
          updateInfo: buildUpdateInfoWithNotes(info, extractRawReleaseNotes(info.releaseNotes)),
          progress: null,
          forceUpdate: false,
          error: "",
          simulated: false,
        });
      })
      .finally(() => {
        if (pendingAvailableTask === task) pendingAvailableTask = null;
      });
    pendingAvailableTask = task;
  });
  autoUpdater.on("update-not-available", (info) => {
    setState(getMainWindow, { status: "not-available", updateInfo: info, progress: null, forceUpdate: false, error: "", simulated: false });
  });
  autoUpdater.on("download-progress", (progress) => {
    setState(getMainWindow, { status: "downloading", progress, error: "", simulated: false });
  });
  autoUpdater.on("update-downloaded", (info) => {
    const preservedNotes = extractRawReleaseNotes(info.releaseNotes) ||
      extractRawReleaseNotes(currentState.updateInfo?.releaseNotes);
    setState(getMainWindow, {
      status: "downloaded",
      updateInfo: buildUpdateInfoWithNotes(info, preservedNotes, currentState.updateInfo?.releaseDate),
      progress: null,
      error: "",
      simulated: false,
    });
  });
  autoUpdater.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`自动更新失败：${message}`);
    if (checkingFallbackFeeds) return;
    setState(getMainWindow, { status: "error", error: message, progress: null });
  });

  ipcMain.handle("updater:get-state", () => currentState);
  ipcMain.handle("updater:check", async (_event, options?: CheckOptions) => {
    const manual = Boolean(options?.manual);
    await requestUpdateCheck(getMainWindow, manual);
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
  if (startupTimer || getStartupServiceState().localMode) return;
  const config = resolveDesktopUpdaterConfig(await getUpdaterBootstrap());
  if (!config.checkOnStartup) return;
  startupTimer = setTimeout(() => {
    void requestUpdateCheck(getMainWindow, false);
  }, config.startupDelayMs);
}
