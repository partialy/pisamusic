import { app, BrowserWindow, ipcMain, shell } from "electron";

let registered = false;

type OpenUrlPayload = {
  url?: string;
  mode?: "window" | "external";
};

type AnnouncementActionPayload =
  | { type: "url"; url?: string; openMode?: "browser" | "app" }
  | { type: "protocol"; value?: string };

export function setupWindowIpc(getMainWindow: () => BrowserWindow | null) {
  if (registered) return;
  registered = true;

  ipcMain.on("window:minimize", () => {
    getMainWindow()?.minimize();
  });

  ipcMain.on("window:maximize-toggle", () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on("window:close", () => {
    getMainWindow()?.close();
  });

  ipcMain.on("window:hide", () => {
    const win = getMainWindow();
    win?.hide();
    win?.webContents.send("window:hide");
  });

  ipcMain.on("window:reload", () => {
    getMainWindow()?.reload();
  });

  ipcMain.on("window:restart-app", () => {
    app.relaunch();
    app.quit();
  });

  ipcMain.on("window:dev-tools", () => {
    getMainWindow()?.webContents.openDevTools();
  });

  ipcMain.handle("window:open-url", async (_event, payload: OpenUrlPayload) => {
    const url = normalizeHttpUrl(payload?.url);
    if (!url) {
      throw new Error("仅支持打开 http/https 链接");
    }

    if (payload?.mode === "external") {
      await shell.openExternal(url);
      return true;
    }

    const win = new BrowserWindow({
      width: 1120,
      height: 760,
      minWidth: 720,
      minHeight: 520,
      title: "PisaMusic",
      autoHideMenuBar: true,
      parent: getMainWindow() ?? undefined,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      const safeUrl = normalizeHttpUrl(targetUrl);
      if (safeUrl) {
        void shell.openExternal(safeUrl);
      }
      return { action: "deny" };
    });
    await win.loadURL(url);
    return true;
  });

  ipcMain.handle("window:open-announcement-action", async (_event, action: AnnouncementActionPayload) => {
    if (action?.type === "url") {
      const url = normalizeHttpsUrl(action.url);
      if (!url) throw new Error("公告跳转仅支持 HTTPS 链接");
      if (action.openMode === "browser") {
        await shell.openExternal(url);
        return true;
      }
      return openHttpWindow(url, getMainWindow);
    }

    if (action?.type === "protocol") {
      const protocol = normalizeAnnouncementProtocol(action.value);
      if (!protocol) throw new Error("公告协议地址无效");
      await shell.openExternal(protocol);
      return true;
    }

    throw new Error("不支持的公告动作");
  });
}

async function openHttpWindow(url: string, getMainWindow: () => BrowserWindow | null): Promise<boolean> {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    title: "PisaMusic",
    autoHideMenuBar: true,
    parent: getMainWindow() ?? undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    const safeUrl = normalizeHttpUrl(targetUrl);
    if (safeUrl) void shell.openExternal(safeUrl);
    return { action: "deny" };
  });
  await win.loadURL(url);
  return true;
}

function normalizeHttpUrl(raw?: string) {
  if (!raw) return "";
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeHttpsUrl(raw?: string) {
  const url = normalizeHttpUrl(raw);
  if (!url || !url.startsWith("https://")) return "";
  return url;
}

function normalizeAnnouncementProtocol(raw?: string) {
  if (!raw) return "";
  const value = raw.trim();
  return /^pisamusic:\/\/[A-Za-z0-9][A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/i.test(value)
    ? value
    : "";
}
