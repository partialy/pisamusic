import { ipcMain } from "electron";
import {
  clearMediaCache,
  getMediaCacheStatus,
  refreshMediaCachePolicy,
} from "../mediaCache";

let registered = false;

export function setupMediaCacheIpc() {
  if (registered) return;
  registered = true;
  ipcMain.handle("media-cache:status", () => getMediaCacheStatus());
  ipcMain.handle("media-cache:refresh-policy", () => refreshMediaCachePolicy());
  ipcMain.handle("media-cache:clear", () => clearMediaCache());
}
