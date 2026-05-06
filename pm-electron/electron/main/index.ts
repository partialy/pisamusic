import { app, BrowserWindow } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { createMainWindow } from "./windows/mainWindow";
import { createAppTray } from "./tray/appTray";
import { registerIpc } from "./ipc/registerIpc";
import { getDb } from "./db/database";
import { refreshBootstrapConfig } from "./services/systemService";

app.setName("PisaMusic");

app.whenReady().then(() => {
  electronApp.setAppUserModelId("cn.partialy.pisamusic.desktop");
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  getDb();
  const win = createMainWindow();
  registerIpc(win);
  createAppTray(win);
  void refreshBootstrapConfig().catch((error) => {
    console.warn("bootstrap config failed", error);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (app.isReady() && !BrowserWindow.getAllWindows().length) {
    const win = createMainWindow();
    registerIpc(win);
    createAppTray(win);
  }
});
