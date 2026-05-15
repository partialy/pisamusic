import { toRaw } from "vue";
import type { Song } from "@/types/song";
import { reportError } from "@/utils/errorReporter";
import { normalizeSong } from "@/utils/song";

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
  const { url: _url, ...dto } = normalized;
  return dto;
}
