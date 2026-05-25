import { ipcMain } from "electron";
import {
  createSyncSpace,
  getSyncState,
  joinSyncSpace,
  syncNow,
  unbindSync,
} from "../sync/syncService";

let registered = false;

export function setupSyncIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("sync:state", () => getSyncState());
  ipcMain.handle("sync:create-space", () => createSyncSpace());
  ipcMain.handle("sync:join-space", (_event, syncCode: string) => joinSyncSpace(syncCode));
  ipcMain.handle("sync:now", () => syncNow());
  ipcMain.handle("sync:unbind", () => unbindSync());
}
