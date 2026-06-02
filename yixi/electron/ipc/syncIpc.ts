import { ipcMain } from "electron";
import { clearSyncState, getSyncState, syncNow } from "../sync/syncService";

let registered = false;

export function setupSyncIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("sync:state", () => getSyncState());
  ipcMain.handle("sync:now", () => syncNow());
  ipcMain.handle("sync:clear-state", () => clearSyncState());
}
