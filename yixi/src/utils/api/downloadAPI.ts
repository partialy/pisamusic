import { toRaw } from "vue";
import type { Song } from "@/types/song";
import { reportError } from "@/utils/errorReporter";
import { normalizeSong } from "@/utils/song";
import { toSafeDownloadSong } from "@/utils/downloadSong";

export type DownloadTaskSnapshot = Awaited<ReturnType<ElectronIpc["listDownloadTasks"]>>[number];
export type DownloadRecordItem = Awaited<ReturnType<ElectronIpc["listDownloadRecords"]>>[number];

export async function startSongDownload(song: Song, qualityKey?: string, directory?: string) {
  const payload = {
    song: toDownloadSongDto(song),
    qualityKey,
    directory: directory || "",
  };
  try {
    return await window.electronAPI.startDownloadTask(payload);
  } catch (error) {
    void reportError(error, {
      scope: "download",
      action: "startSongDownload",
      songId: payload.song.id,
      source: payload.song.source,
      qualityKey,
    });
    throw error;
  }
}

export async function listDownloadTasks() {
  return window.electronAPI.listDownloadTasks();
}

export async function listDownloadRecords() {
  return window.electronAPI.listDownloadRecords();
}

export async function listDownloadedSongs() {
  return window.electronAPI.listDownloadedSongs();
}

export async function downloadCurrentSong(song: Song, qualityKey?: string, directory?: string) {
  return startSongDownload(song, qualityKey, directory);
}

function toDownloadSongDto(song: Song) {
  const normalized = normalizeSong(toRaw(song));
  return toSafeDownloadSong(normalized);
}

/** 单批持久化入队，任务传输由 main FIFO 调度。 */
export async function enqueueDownloads(items: import("@/types/download").DownloadEnqueueItem[], options?: import("@/types/download").DownloadEnqueueOptions) {
  return window.electronAPI.enqueueDownloads(items.map(item => ({ ...item, song: toSafeDownloadSong(toRaw(item.song)) })),options);
}
export const pauseDownload = (id: string) => window.electronAPI.pauseDownload(id);
export const resumeDownload = (id: string) => window.electronAPI.resumeDownload(id);
export const cancelDownload = (id: string) => window.electronAPI.cancelDownload(id);
export const retryDownload = (id: string) => window.electronAPI.retryDownload(id);
export const pauseAllDownloads = () => window.electronAPI.pauseAllDownloads();
export const resumeAllDownloads = () => window.electronAPI.resumeAllDownloads();
export const getDownloadDetail = (id: string) => window.electronAPI.getDownloadDetail(id);
export const listDownloadFiles = () => window.electronAPI.listDownloadFiles();
