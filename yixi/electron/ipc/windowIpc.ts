import { BrowserWindow, ipcMain } from "electron";

let registered = false;

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

  ipcMain.on("window:dev-tools", () => {
    getMainWindow()?.webContents.openDevTools();
  });
}

