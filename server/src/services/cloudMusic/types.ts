import type {
  CloudMusicAsset,
  CloudMusicAssetKind,
  CloudMusicAssetState,
  CloudMusicStatus,
  CloudMusicUploadState,
  CloudMusicPublicSummary as StorePublicSummary,
} from "../../db/cloudMusicStore";
import type { CloudMusicFileInfo } from "../cloudMusicAssets";

export type {
  CloudMusicAsset,
  CloudMusicAssetKind,
  CloudMusicAssetState,
  CloudMusicStatus,
  CloudMusicUploadState,
};

export type CloudMusicOwner =
  | { type: "system"; userId: null; displayName: "system" }
  | { type: "user"; userId: string; displayName: string };

export type CloudMusicTrackDto = {
  uuid: string;
  source: "cloud";
  owner: CloudMusicOwner;
  status: CloudMusicStatus;
  uploadState: CloudMusicUploadState;
  statusReason: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  format: string;
  codec: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  year: number | null;
  trackNo: number | null;
  playable: boolean;
  cover: { source: "uploaded" | "embedded" | "default"; url: string };
  lyrics: null | { format: "lrc" | "txt"; fileName: string };
  audioFile: CloudMusicFileInfo | null;
  createdAt: number;
  updatedAt: number;
  reviewedAt: number | null;
  reviewedBy: string;
};

export type CloudMusicPublicTrack = Pick<
  CloudMusicTrackDto,
  | "uuid"
  | "source"
  | "title"
  | "artist"
  | "album"
  | "durationMs"
  | "format"
  | "playable"
  | "cover"
  | "lyrics"
  | "createdAt"
  | "updatedAt"
>;

export type CloudMusicSelectedFile = {
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type CloudMusicUploadSessionRequest = {
  audio: CloudMusicSelectedFile;
  cover?: CloudMusicSelectedFile;
  lyrics?: CloudMusicSelectedFile;
};

export type CloudMusicAssetReserveRequest = CloudMusicSelectedFile & {
  kind: "cover-uploaded" | "lyrics";
};

export type CloudMusicAssetUploadTicket = {
  assetId: string;
  fileRecordId: string;
  kind: CloudMusicAssetKind;
  key: string;
  uploadToken: string;
  uploadUrl: string;
};

export type CloudMusicUploadSession = {
  uuid: string;
  track: CloudMusicTrackDto;
  tickets: CloudMusicAssetUploadTicket[];
};

export type CloudMusicAdminParsedAudioInput = {
  title?: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  format?: string;
  codec?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  year?: number | null;
  trackNo?: number | null;
};

export type CloudMusicAdminSaveInput = {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  status: "active" | "disabled" | "offline";
  statusReason?: string;
  format?: string;
  codec?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  year?: number | null;
  trackNo?: number | null;
};

export type CloudMusicReviewInput =
  | { decision: "approve"; targetStatus: "active" | "disabled"; reason?: string }
  | { decision: "reject"; reason: string }
  | { decision: "resubmit"; reason?: string }
  | { decision: "ban_destroy"; reason: string };

export type CloudMusicResourceUrls = {
  audioUrl: string;
  audioExpiresAt: number;
  coverUrl: string;
  lyricsUrl: string | null;
  lyricsExpiresAt: number | null;
};

export type CloudMusicTempCleanupInput = { olderThanHours: 0 | 24 | 72 };
export type CloudMusicTempCleanupResult = {
  scanned: number;
  deleted: number;
  failed: Array<{ uuid: string; message: string }>;
};

export type CloudMusicTempSummary = {
  total: { count: number; bytes: number };
  olderThan24h: { count: number; bytes: number };
  olderThan72h: { count: number; bytes: number };
  staleAssets: { count: number; bytes: number };
};

export type CloudMusicListResult = {
  items: CloudMusicTrackDto[];
  total: number;
  offset: number;
  limit: number;
};

export type CloudMusicSearchResponse = {
  source: "cloud";
  items: CloudMusicPublicTrack[];
  total: number;
  offset: number;
  limit: number;
};

export type CloudMusicPlayUrlResponse = {
  uuid: string;
  source: "cloud";
  url: string;
  expiresAt: number;
};

export type CloudMusicLyricsUrlResponse = {
  uuid: string;
  source: "cloud";
  url: string;
  expiresAt: number;
  format: "lrc" | "txt";
};

export type CloudMusicPublicSummary = StorePublicSummary;

export type CloudMusicUserSubmitInput = {
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
};
