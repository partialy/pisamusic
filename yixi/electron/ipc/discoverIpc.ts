import { ipcMain, session, type BrowserWindow, type WebContents } from "electron";
import discoverHtml from "../../../pm/app/src/main/assets/discover/index.html?raw";
import { requestSystem, unwrapResponse } from "../system/systemClient";

const DISCOVER_PARTITION = "pisa-discover";
const LOCAL_DISCOVER_URL = `data:text/html;charset=utf-8,${encodeURIComponent(discoverHtml)}`;
const approvedSources = new WeakMap<WebContents, string>();
const requests = new WeakMap<WebContents, AbortController>();

function normalizeWebUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function setupDiscoverIpc(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle("discover:get-page", async (event) => {
    if (event.sender !== getMainWindow()?.webContents || event.senderFrame !== event.sender.mainFrame) {
      throw new Error("发现页只能从主窗口打开");
    }

    const host = event.sender;
    requests.get(host)?.abort();
    approvedSources.delete(host);
    const request = new AbortController();
    requests.set(host, request);
    try {
      const { url } = unwrapResponse(await requestSystem<{ url: string }>("/api/config/discover", {
        token: null,
        encrypted: false,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
      }));
      if (request.signal.aborted || host.isDestroyed()) throw new Error("发现页加载已取消");
      if (typeof url !== "string") throw new Error("发现页网址无效");
      const source = url.trim() === "USE_LOCAL_FILE" ? LOCAL_DISCOVER_URL : normalizeWebUrl(url);
      if (!source) throw new Error("发现页网址无效");
      approvedSources.set(host, source);
      return source;
    } finally {
      if (requests.get(host) === request) requests.delete(host);
    }
  });
}

export function attachDiscoverGuestPolicy(window: BrowserWindow) {
  const host = window.webContents;
  const guestSession = session.fromPartition(DISCOVER_PARTITION);
  guestSession.setPermissionCheckHandler(() => false);
  guestSession.setPermissionRequestHandler((_contents, _permission, resolve) => resolve(false));

  // 只允许由发现接口授权的单次初始导航，所有远端页面使用单独的沙箱会话。
  host.on("will-attach-webview", (event, preferences, params) => {
    const approvedSource = approvedSources.get(host);
    if (!approvedSource || approvedSource !== params.src || params.partition !== DISCOVER_PARTITION) {
      event.preventDefault();
      return;
    }
    approvedSources.delete(host);
    delete preferences.preload;
    Object.assign(preferences, {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: false,
    });
  });

  host.on("did-attach-webview", (_event, guest) => {
    guest.setWindowOpenHandler(() => ({ action: "deny" }));
    guest.on("will-navigate", (event) => {
      if (!normalizeWebUrl(event.url)) event.preventDefault();
    });
    guest.on("will-redirect", (event) => {
      if (!normalizeWebUrl(event.url)) event.preventDefault();
    });
  });
}
