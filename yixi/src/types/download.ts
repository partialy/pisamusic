import type { TrackSnapshot } from "../../electron/database/types";
import type { DownloadLyricsMode } from "../utils/downloadSettings";
export type DownloadTaskState = "queued" | "preparing" | "running" | "pausing" | "paused" | "processing" | "completed" | "failed" | "cancelled";
export type DownloadConfiguration = {
  namingMode: string;
  embedDownloadTags: boolean;
  embedDownloadCover: boolean;
  embedDownloadLyrics: boolean;
  downloadLyricsMode: DownloadLyricsMode;
};
export type DownloadSongInput = {
  id: string; source: string; name?: string; singer?: string; album?: string; cover?: string;
  duration?: number; durationMs?: number; urlParam?: string; coverSize?: unknown; size?: unknown;
  d_cover?: string; lyric?: string; krc?: string; vip?: boolean;
};
export type DownloadEnqueueItem = { song: DownloadSongInput; qualityKey?: string; directory: string; redownload?: boolean };
export type DownloadEnqueueOptions = { identityRevision?: number };
export type DownloadEnqueueResult = { tasks: DownloadTaskSnapshot[]; added: number; existing: number; rejected: { index: number; message: string }[] };
export type DownloadTaskSnapshot = {
  taskId: string; fileId: string; source: string; songId: string; qualityKey: string; name: string;
  status: DownloadTaskState; progress: number; receivedBytes: number; totalBytes: number;
  speedBytesPerSecond: number; directory: string; filePath: string; error: string;
  createdAt: string; updatedAt: string; retryCount: number; pauseReason: string; generation: number;
};
export type DownloadFileSnapshot = {
  fileId: string; taskId: string; filePath: string; source: string; songId: string; qualityKey: string;
  size: number; durationMs: number; metadataStatus: "embedded" | "sidecar" | "failed";
  metadataJsonPath: string; coverPath: string; lyricPaths: string[]; payload: TrackSnapshot;
  completedAt: string; legacyId: number | null; message: string;
};
export type DownloadDetail = { task: DownloadTaskSnapshot; file: DownloadFileSnapshot | null; configuration: DownloadConfiguration };
