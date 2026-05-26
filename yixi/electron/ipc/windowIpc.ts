import { app, BrowserWindow, ipcMain, shell } from "electron";

let registered = false;

type OpenUrlPayload = {
  url?: string;
  mode?: "window" | "external";
};

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
