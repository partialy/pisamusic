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
export type SongDownloadQuotaDimension = {
  limit: number | null;
  used: number;
  remaining: number | null;
};
export type SongDownloadQuotaSnapshot = {
  subjectType: "user" | "device";
  subjectKey: string;
  isGuest?: boolean;
  overrideEnabled: boolean;
  extraRemaining?: number;
  daily: SongDownloadQuotaDimension;
  weekly: SongDownloadQuotaDimension;
  monthly: SongDownloadQuotaDimension;
  total: SongDownloadQuotaDimension;
};
export type SongDownloadQuotaAcquireResult = {
  allowed: boolean;
  deduplicated: boolean;
  batchId: string | null;
  chargedCount: number;
  requiredCount: number;
  quota: SongDownloadQuotaSnapshot;
};
export type DownloadEnqueueOptions = { identityRevision?: number };
export type DownloadEnqueueResult = {
  tasks: DownloadTaskSnapshot[];
  added: number;
  existing: number;
  rejected: { index: number; message: string }[];
  quotaExceeded?: SongDownloadQuotaAcquireResult;
};
export type DownloadTaskSnapshot = {
  taskId: string; fileId: string; source: string; songId: string; qualityKey: string; name: string;
  singer?: string; album?: string; cover?: string;
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
export type DownloadFileTarget = { fileId?: string; taskId?: string };
export type DownloadDeletePreview = { previewId: string; targets: DownloadFileTarget[]; count: number };
export type DownloadDeleteItem = DownloadFileTarget & {
  recordsRemoved: number; filesDeleted: number;
  status: "removed" | "shared" | "occupied" | "failed" | "not-executed"; message: string;
};
export type DownloadDeleteResult = {
  recordsRemoved: number; filesDeleted: number; sharedSkipped: number; occupied: number; failed: number; notExecuted: number;
  items: DownloadDeleteItem[];
};
export type DownloadFileDetail = DownloadDetail & { stat: { exists: boolean; size: number; modifiedAt: string; identity: string; error: string } };
export type DownloadBatchRepairResult = {
  total: number;
  repaired: number;
  failed: number;
  items: (DownloadFileTarget & { status: "repaired" | "failed"; message: string })[];
};
export type LocalFileRemoveResult = {
  removed: boolean; deleted: boolean;
  status: "deleted" | "record-only" | "missing" | "shared" | "occupied" | "failed" | "not-executed";
  reason: string;
};
