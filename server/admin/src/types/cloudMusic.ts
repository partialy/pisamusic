export type CloudMusicStatus =
  | "temp"
  | "active"
  | "disabled"
  | "offline"
  | "pending_review"
  | "rejected"
  | "deleted";

export type CloudMusicUploadState =
  | "reserved"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

export type CloudMusicAssetKind = "audio" | "cover-uploaded" | "cover-extracted" | "lyrics";

export type CloudMusicOwner =
  | { type: "system"; userId: null; displayName: "system" }
  | { type: "user"; userId: string; displayName: string };

export type CloudMusicFileInfo = {
  bucket: string;
  objectKey: string;
  assetId: string;
  fileRecordId: string;
  trackUuid: string;
  kind: CloudMusicAssetKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
  hash: string;
};

export type CloudMusicTrack = {
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

export type CloudMusicListFilter = {
  keyword?: string;
  status?: CloudMusicStatus | "all";
  uploadState?: CloudMusicUploadState | "all";
  offset?: number;
  limit?: number;
};

export type CloudMusicListResponse = {
  items: CloudMusicTrack[];
  total: number;
  offset: number;
  limit: number;
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
  track: CloudMusicTrack;
  tickets: CloudMusicAssetUploadTicket[];
};

export type CloudMusicAdminSaveInput = {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  status: "active" | "disabled" | "offline";
  statusReason?: string;
};

export type CloudMusicReviewInput =
  | { decision: "approve"; targetStatus: "active" | "disabled" }
  | { decision: "reject"; reason: string }
  | { decision: "resubmit"; reason?: string };

export type CloudMusicResourceUrls = {
  audioUrl: string;
  audioExpiresAt: number;
  coverUrl: string;
  lyricsUrl: string | null;
  lyricsExpiresAt: number | null;
};

export type CloudMusicTempSummary = {
  total: { count: number; bytes: number };
  olderThan24h: { count: number; bytes: number };
  olderThan72h: { count: number; bytes: number };
  staleAssets: { count: number; bytes: number };
};

export type CloudMusicTempCleanupResult = {
  scanned: number;
  deleted: number;
  failed: Array<{ uuid: string; message: string }>;
};

export type CloudMusicSelectedFiles = {
  audio: File;
  cover?: File;
  lyrics?: File;
};
