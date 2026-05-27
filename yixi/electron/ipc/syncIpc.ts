import { ipcMain } from "electron";
import { getSyncState, syncNow, unbindSync } from "../sync/syncService";

let registered = false;

export function setupSyncIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("sync:state", () => getSyncState());
  ipcMain.handle("sync:now", () => syncNow());
  ipcMain.handle("sync:unbind", () => unbindSync());
}
