import { ipcMain } from "electron";
import { previewDownloadDelete, deleteDownloads, getDownloadFileDetail, revealDownloadFile, openDownloadDirectory } from "../download/downloadFileService";
import { repairDownloadFile, repairDownloadFiles } from "../download/downloadRepairService";
import type { DownloadFileTarget } from "../../src/types/download";
import {
  listDownloadedSongs, listDownloadRecords, listDownloadTasks, startDownloadTask,
  enqueueDownloads, pauseDownload, resumeDownload, pauseAllDownloads, resumeAllDownloads,
  getDownloadDetail, listDownloadFiles, initializeDownloadService, selectDownloadTaskDirectory,
} from "../download/downloadService";
import type { DownloadEnqueueItem, DownloadEnqueueOptions } from "../../src/types/download";
let registered = false;
function taskId(value: unknown) { if (typeof value !== "string" || !/^[a-f0-9-]{36}$/i.test(value)) throw new Error("无效任务ID"); return value; }
export function setupDownloadIpc() {
  if (registered) return;
  registered = true;
  void initializeDownloadService().catch(error => console.error("下载恢复失败",error));
  ipcMain.handle("download:start", (_event, payload: DownloadEnqueueItem) => startDownloadTask(payload));
  ipcMain.handle("download:enqueue", (_event, items: DownloadEnqueueItem[], options?: DownloadEnqueueOptions) => enqueueDownloads(items,options));
  ipcMain.handle("download:tasks", () => listDownloadTasks());
  ipcMain.handle("download:records", () => listDownloadRecords());
  ipcMain.handle("download:files", () => listDownloadFiles());
  ipcMain.handle("download:songs", () => listDownloadedSongs());
  ipcMain.handle("download:pause", (_event,id: string) => pauseDownload(taskId(id)));
  ipcMain.handle("download:resume", (_event,id: string) => resumeDownload(taskId(id)));
  ipcMain.handle("download:pause-all", () => pauseAllDownloads());
  ipcMain.handle("download:resume-all", () => resumeAllDownloads());
  ipcMain.handle("download:cancel", (_event,id: string) => pauseDownload(taskId(id),true));
  ipcMain.handle("download:retry", (_event,id: string) => resumeDownload(taskId(id),true));
  ipcMain.handle("download:detail", (_event,id: string) => getDownloadDetail(taskId(id)));
  ipcMain.handle("download:select-task-directory", (_event,id: string) => selectDownloadTaskDirectory(taskId(id)));
  ipcMain.handle("download:delete-preview", (_event, input: { targets?: DownloadFileTarget[]; all?: boolean }) => previewDownloadDelete(input));
  ipcMain.handle("download:delete", (_event, input: { previewId: string; deleteFiles: boolean; confirmed?: boolean }) => deleteDownloads(input));
  ipcMain.handle("download:file-detail", (_event, target: DownloadFileTarget) => getDownloadFileDetail(target));
  ipcMain.handle("download:reveal-file", (_event, target: DownloadFileTarget) => revealDownloadFile(target));
  ipcMain.handle("download:open-directory", (_event, target: DownloadFileTarget) => openDownloadDirectory(target));
  ipcMain.handle("download:repair", (_event, target: DownloadFileTarget) => repairDownloadFile(target));
  ipcMain.handle("download:repair-batch", (_event, targets: DownloadFileTarget[]) => repairDownloadFiles(targets));
}
