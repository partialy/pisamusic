import { ipcMain } from "electron";
import {
  listDownloadedSongs,
  listDownloadRecords,
  listDownloadTasks,
  startDownloadTask,
} from "../download/downloadService";
import type { TrackSnapshot } from "../database/appDatabase";

let registered = false;

export function setupDownloadIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("download:start", (_event, payload: { song: TrackSnapshot; qualityKey?: string; directory: string }) =>
    startDownloadTask(payload)
  );
  ipcMain.handle("download:tasks", () => listDownloadTasks());
  ipcMain.handle("download:records", () => listDownloadRecords());
  ipcMain.handle("download:songs", () => listDownloadedSongs());
}
