import { randomUUID } from "node:crypto";
import path from "node:path";
import { getAppDb } from "../db/appDb";
import {
  confirmCloudMusicAsset,
  createCloudMusicUploadSession as dbCreateUploadSession,
  listCloudMusicTracks,
  listStaleTempTracks,
  markCloudMusicDeleted,
  readCloudMusicByFileRecordId,
  readCloudMusicReservedAsset,
  readCloudMusicTrack,
  reserveCloudMusicAsset,
  searchVisibleCloudMusic,
  transitionCloudMusicStatus,
  updateCloudMusicDraft,
  type CloudMusicAsset,
  type CloudMusicAssetKind,
  type CloudMusicAssetState,
  type CloudMusicListInput,
  type CloudMusicListResult as StoreListResult,
  type CloudMusicSearchInput,
  type CloudMusicStatus,
  type CloudMusicTrack as StoreTrack,
  type CloudMusicUploadState,
} from "../db/cloudMusicStore";
export type {
  CloudMusicAsset,
  CloudMusicAssetKind,
  CloudMusicAssetState,
  CloudMusicStatus,
  CloudMusicUploadState,
};
import { readFileRecordById } from "../db/configStore";
import {
  buildCloudMusicAssetObjectKey,
  CLOUD_MUSIC_DEFAULT_COVER_PATH,
  createCloudMusicAssetUploadToken,
  createCloudMusicAssetUrl,
  deleteCloudMusicAsset,
  inferAssetMimeType,
  requireCloudMusicAssetExtension,
  statCloudMusicAsset,
  uploadExtractedCover,
  type CloudMusicFileInfo,
} from "./cloudMusicAssets";
import {
  extractCloudMusicMetadata,
  validateCloudMusicCover,
  validateCloudMusicLyrics,
} from "./cloudMusicMetadata";

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
};

function getRequiredBucket(): string {
  const bucket = String(process.env.QINIU_BUCKET ?? "").trim();
  if (!bucket) throw new Error("缺少七牛配置：QINIU_BUCKET");
  return bucket;
}

function findCurrentAsset(assets: CloudMusicAsset[], kind: CloudMusicAssetKind): CloudMusicAsset | null {
  const current = assets.find((item) => item.kind === kind && item.isCurrent && item.state === "uploaded" && item.deletedAt === null);
  if (current) return current;
  return assets.find((item) => item.kind === kind && item.state === "uploaded" && item.deletedAt === null) ?? null;
}

function resolveFileInfo(asset: CloudMusicAsset | null): CloudMusicFileInfo | null {
  if (!asset) return null;
  const file = readFileRecordById(asset.fileRecordId);
  if (!file) return null;
  return {
    bucket: file.bucket,
    objectKey: file.objectKey,
    assetId: asset.id,
    fileRecordId: asset.fileRecordId,
    trackUuid: asset.trackUuid,
    kind: asset.kind,
    fileName: file.fileName,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    hash: file.hash,
  };
}

export function toCloudMusicTrackDto(track: StoreTrack): CloudMusicTrackDto {
  const uploadedCoverAsset = findCurrentAsset(track.assets, "cover-uploaded");
  const extractedCoverAsset = findCurrentAsset(track.assets, "cover-extracted");
  const lyricsAsset = findCurrentAsset(track.assets, "lyrics");
  const audioAsset = findCurrentAsset(track.assets, "audio")
    ?? track.assets.find((item) => item.kind === "audio" && item.deletedAt === null)
    ?? null;

  let cover: CloudMusicTrackDto["cover"] = {
    source: "default",
    url: CLOUD_MUSIC_DEFAULT_COVER_PATH,
  };

  if (uploadedCoverAsset) {
    const file = readFileRecordById(uploadedCoverAsset.fileRecordId);
    if (file && file.status === "uploaded") {
      cover = {
        source: "uploaded",
        url: createCloudMusicAssetUrl(file, 3600),
      };
    }
  } else if (extractedCoverAsset) {
    const file = readFileRecordById(extractedCoverAsset.fileRecordId);
    if (file && file.status === "uploaded") {
      cover = {
        source: "embedded",
        url: createCloudMusicAssetUrl(file, 3600),
      };
    }
  }

  let lyrics: CloudMusicTrackDto["lyrics"] = null;
  if (lyricsAsset) {
    const file = readFileRecordById(lyricsAsset.fileRecordId);
    if (file && file.status === "uploaded") {
      const ext = path.extname(file.fileName).slice(1).toLowerCase();
      const format = (track.lyricsFormat as "lrc" | "txt") || (ext === "txt" ? "txt" : "lrc");
      lyrics = {
        format,
        fileName: file.fileName,
      };
    }
  }

  const audioFile = resolveFileInfo(audioAsset);
  const playable = track.status === "active" && track.uploadState === "ready" && audioFile !== null && audioFile.fileSize > 0;

  return {
    uuid: track.uuid,
    source: "cloud",
    owner: { type: "system", userId: null, displayName: "system" },
    status: track.status,
    uploadState: track.uploadState,
    statusReason: track.statusReason,
    title: track.title,
    artist: track.artist,
    album: track.album,
    durationMs: track.durationMs,
    format: track.format,
    codec: track.codec,
    bitrate: track.bitrate,
    sampleRate: track.sampleRate,
    channels: track.channels,
    year: track.year,
    trackNo: track.trackNo,
    playable,
    cover,
    lyrics,
    audioFile,
    createdAt: track.createdAt,
    updatedAt: track.updatedAt,
    reviewedAt: track.reviewedAt,
    reviewedBy: track.reviewedBy,
  };
}

export function toCloudMusicPublicTrack(dto: CloudMusicTrackDto): CloudMusicPublicTrack {
  return {
    uuid: dto.uuid,
    source: "cloud",
    title: dto.title,
    artist: dto.artist,
    album: dto.album,
    durationMs: dto.durationMs,
    format: dto.format,
    playable: dto.playable,
    cover: dto.cover,
    lyrics: dto.lyrics,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function createAdminUploadSession(input: CloudMusicUploadSessionRequest): CloudMusicUploadSession {
  const uuid = randomUUID();
  const bucket = getRequiredBucket();
  const now = new Date();

  requireCloudMusicAssetExtension("audio", input.audio.fileName);
  const audioAssetId = randomUUID();
  const audioFileRecordId = randomUUID();
  const audioObjectKey = buildCloudMusicAssetObjectKey(uuid, "audio", input.audio.fileName, now);
  const audioMimeType = inferAssetMimeType("audio", input.audio.fileName, input.audio.mimeType);

  let coverAssetInput: { assetId: string; fileRecordId: string; bucket: string; objectKey: string; fileName: string; mimeType: string; fileSize: number } | undefined;
  if (input.cover) {
    requireCloudMusicAssetExtension("cover-uploaded", input.cover.fileName);
    coverAssetInput = {
      assetId: randomUUID(),
      fileRecordId: randomUUID(),
      bucket,
      objectKey: buildCloudMusicAssetObjectKey(uuid, "cover-uploaded", input.cover.fileName, now),
      fileName: input.cover.fileName,
      mimeType: inferAssetMimeType("cover-uploaded", input.cover.fileName, input.cover.mimeType),
      fileSize: input.cover.fileSize,
    };
  }

  let lyricsAssetInput: { assetId: string; fileRecordId: string; bucket: string; objectKey: string; fileName: string; mimeType: string; fileSize: number } | undefined;
  if (input.lyrics) {
    requireCloudMusicAssetExtension("lyrics", input.lyrics.fileName);
    lyricsAssetInput = {
      assetId: randomUUID(),
      fileRecordId: randomUUID(),
      bucket,
      objectKey: buildCloudMusicAssetObjectKey(uuid, "lyrics", input.lyrics.fileName, now),
      fileName: input.lyrics.fileName,
      mimeType: inferAssetMimeType("lyrics", input.lyrics.fileName, input.lyrics.mimeType),
      fileSize: input.lyrics.fileSize,
    };
  }

  const track = dbCreateUploadSession({
    uuid,
    audio: {
      assetId: audioAssetId,
      fileRecordId: audioFileRecordId,
      bucket,
      objectKey: audioObjectKey,
      fileName: input.audio.fileName,
      mimeType: audioMimeType,
      fileSize: input.audio.fileSize,
    },
    cover: coverAssetInput,
    lyrics: lyricsAssetInput,
  });

  const tickets: CloudMusicAssetUploadTicket[] = [];

  const audioReserved = readCloudMusicReservedAsset(audioFileRecordId);
  if (!audioReserved) throw new Error("音频资产预登记失败");
  const audioTicket = createCloudMusicAssetUploadToken({ uuid, asset: audioReserved });
  tickets.push({
    assetId: audioAssetId,
    fileRecordId: audioFileRecordId,
    kind: "audio",
    key: audioObjectKey,
    uploadToken: audioTicket.uploadToken,
    uploadUrl: audioTicket.uploadUrl,
  });

  if (coverAssetInput) {
    const coverReserved = readCloudMusicReservedAsset(coverAssetInput.fileRecordId);
    if (!coverReserved) throw new Error("封面资产预登记失败");
    const coverTicket = createCloudMusicAssetUploadToken({ uuid, asset: coverReserved });
    tickets.push({
      assetId: coverAssetInput.assetId,
      fileRecordId: coverAssetInput.fileRecordId,
      kind: "cover-uploaded",
      key: coverAssetInput.objectKey,
      uploadToken: coverTicket.uploadToken,
      uploadUrl: coverTicket.uploadUrl,
    });
  }

  if (lyricsAssetInput) {
    const lyricsReserved = readCloudMusicReservedAsset(lyricsAssetInput.fileRecordId);
    if (!lyricsReserved) throw new Error("歌词资产预登记失败");
    const lyricsTicket = createCloudMusicAssetUploadToken({ uuid, asset: lyricsReserved });
    tickets.push({
      assetId: lyricsAssetInput.assetId,
      fileRecordId: lyricsAssetInput.fileRecordId,
      kind: "lyrics",
      key: lyricsAssetInput.objectKey,
      uploadToken: lyricsTicket.uploadToken,
      uploadUrl: lyricsTicket.uploadUrl,
    });
  }

  return {
    uuid,
    track: toCloudMusicTrackDto(track),
    tickets,
  };
}

export function reserveAsset(uuid: string, input: CloudMusicAssetReserveRequest): CloudMusicAssetUploadTicket {
  if (input.kind !== "cover-uploaded" && input.kind !== "lyrics") {
    throw new Error("仅支持预登记封面或歌词资产");
  }
  const track = readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  requireCloudMusicAssetExtension(input.kind, input.fileName);
  const bucket = getRequiredBucket();
  const assetId = randomUUID();
  const fileRecordId = randomUUID();
  const objectKey = buildCloudMusicAssetObjectKey(uuid, input.kind, input.fileName);
  const mimeType = inferAssetMimeType(input.kind, input.fileName, input.mimeType);

  const reserved = reserveCloudMusicAsset({
    trackUuid: uuid,
    assetId,
    fileRecordId,
    kind: input.kind,
    bucket,
    objectKey,
    fileName: input.fileName,
    mimeType,
    fileSize: input.fileSize,
  });

  const ticket = createCloudMusicAssetUploadToken({ uuid, asset: reserved });
  return {
    assetId,
    fileRecordId,
    kind: input.kind,
    key: objectKey,
    uploadToken: ticket.uploadToken,
    uploadUrl: ticket.uploadUrl,
  };
}

export async function confirmAsset(uuid: string, kind: CloudMusicAssetKind): Promise<CloudMusicTrackDto> {
  const track = readCloudMusicTrack(uuid, true);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  const pendingAsset = track.assets.find((item) => item.kind === kind && item.state === "pending" && item.deletedAt === null);

  if (!pendingAsset) {
    const currentAsset = track.assets.find((item) => item.kind === kind && item.state === "uploaded" && item.isCurrent && item.deletedAt === null);
    if (currentAsset) {
      return toCloudMusicTrackDto(track);
    }
    throw new Error(`未找到待确认的 ${kind} 资产记录`);
  }

  const reserved = readCloudMusicReservedAsset(pendingAsset.fileRecordId);
  if (!reserved) throw new Error(`待确认的 ${kind} 预登记资产不存在`);

  const stat = await statCloudMusicAsset(reserved);

  if (kind === "audio") {
    const db = getAppDb();
    db.prepare(`UPDATE cloud_music_tracks SET upload_state = 'processing', updated_at = ? WHERE uuid = ?`).run(Date.now(), uuid);
    const signedUrl = createCloudMusicAssetUrl(reserved, 300);

    try {
      const extracted = await extractCloudMusicMetadata({
        signedUrl,
        fileName: reserved.fileName,
        expectedSize: stat.fileSize,
      });

      if (extracted.embeddedCover) {
        try {
          await uploadExtractedCover({
            uuid,
            data: extracted.embeddedCover.data,
            mimeType: extracted.embeddedCover.mimeType,
          });
        } catch (coverErr) {
          extracted.warnings.push(`内嵌封面提取失败: ${coverErr instanceof Error ? coverErr.message : String(coverErr)}`);
        }
      }

      const updated = confirmCloudMusicAsset({
        fileRecordId: reserved.fileRecordId,
        hash: stat.hash,
        mimeType: stat.mimeType,
        fileSize: stat.fileSize,
        uploadState: "ready",
        statusReason: "",
        parsed: {
          title: extracted.title,
          artist: extracted.artist,
          album: extracted.album,
          durationMs: extracted.durationMs,
          format: extracted.format,
          codec: extracted.codec,
          bitrate: extracted.bitrate,
          sampleRate: extracted.sampleRate,
          channels: extracted.channels,
          year: extracted.year,
          trackNo: extracted.trackNo,
          metadata: extracted.metadata,
        },
      });
      return toCloudMusicTrackDto(updated);
    } catch (parseError) {
      const reason = parseError instanceof Error ? parseError.message : String(parseError);
      confirmCloudMusicAsset({
        fileRecordId: reserved.fileRecordId,
        hash: stat.hash,
        mimeType: stat.mimeType,
        fileSize: stat.fileSize,
        uploadState: "failed",
        statusReason: reason,
      });
      throw parseError;
    }
  }

  if (kind === "cover-uploaded") {
    const signedUrl = createCloudMusicAssetUrl(reserved, 300);
    await validateCloudMusicCover({
      signedUrl,
      fileName: reserved.fileName,
      expectedSize: stat.fileSize,
      expectedMimeType: reserved.mimeType,
    });
    const updated = confirmCloudMusicAsset({
      fileRecordId: reserved.fileRecordId,
      hash: stat.hash,
      mimeType: stat.mimeType,
      fileSize: stat.fileSize,
    });
    return toCloudMusicTrackDto(updated);
  }

  if (kind === "lyrics") {
    const signedUrl = createCloudMusicAssetUrl(reserved, 300);
    const lyricsVal = await validateCloudMusicLyrics({
      signedUrl,
      fileName: reserved.fileName,
      expectedSize: stat.fileSize,
    });
    const updated = confirmCloudMusicAsset({
      fileRecordId: reserved.fileRecordId,
      hash: stat.hash,
      mimeType: stat.mimeType,
      fileSize: stat.fileSize,
      parsed: {
        lyricsFormat: lyricsVal.format,
      },
    });
    return toCloudMusicTrackDto(updated);
  }

  throw new Error(`不支持的资产类型确认: ${kind}`);
}

export function saveAdminDraft(uuid: string, input: CloudMusicAdminSaveInput, adminUsername: string): CloudMusicTrackDto {
  const track = readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  const title = input.title.trim();
  if (!title || title.length > 200) throw new Error("歌名长度应在 1-200 字符之间");

  const artist = input.artist.trim();
  if (!artist || artist.length > 300) throw new Error("歌手长度应在 1-300 字符之间");

  const album = input.album.trim();
  if (album.length > 200) throw new Error("专辑名称不能超过 200 字符");

  const durationMs = Math.trunc(input.durationMs);
  if (!Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs > 86400000) {
    throw new Error("时长不正确，应在 0 至 24 小时之间");
  }

  if (!["active", "disabled", "offline"].includes(input.status)) {
    throw new Error("保存状态仅允许 active、disabled 或 offline");
  }

  if (track.uploadState !== "ready") {
    throw new Error("网盘音乐音频未就绪，不可保存为正式状态");
  }

  updateCloudMusicDraft(uuid, {
    title,
    artist,
    album,
    durationMs,
  });

  const updated = transitionCloudMusicStatus({
    uuid,
    status: input.status,
    statusReason: input.statusReason?.trim() ?? "",
    reviewedBy: adminUsername,
  });

  if (!updated) throw new Error("保存网盘音乐状态失败");
  return toCloudMusicTrackDto(updated);
}

export function review(uuid: string, input: CloudMusicReviewInput, adminUsername: string): CloudMusicTrackDto {
  const track = readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  if (input.decision === "approve") {
    if (!["active", "disabled"].includes(input.targetStatus)) {
      throw new Error("审核通过的目标状态仅允许 active 或 disabled");
    }
    if (track.uploadState !== "ready") {
      throw new Error("网盘音乐音频未就绪，不能审核通过");
    }
    const updated = transitionCloudMusicStatus({
      uuid,
      status: input.targetStatus,
      statusReason: "",
      reviewedBy: adminUsername,
    });
    if (!updated) throw new Error("审核操作失败");
    return toCloudMusicTrackDto(updated);
  }

  if (input.decision === "reject") {
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) {
      throw new Error("审核拒绝原因长度应在 1-500 字符之间");
    }
    const updated = transitionCloudMusicStatus({
      uuid,
      status: "rejected",
      statusReason: reason,
      reviewedBy: adminUsername,
    });
    if (!updated) throw new Error("审核操作失败");
    return toCloudMusicTrackDto(updated);
  }

  if (input.decision === "resubmit") {
    if (track.status !== "rejected") {
      throw new Error("只有已拒绝的曲目可以重新送审");
    }
    const updated = transitionCloudMusicStatus({
      uuid,
      status: "pending_review",
      statusReason: input.reason?.trim() ?? "",
      reviewedBy: adminUsername,
    });
    if (!updated) throw new Error("重新送审失败");
    return toCloudMusicTrackDto(updated);
  }

  throw new Error("未知的审核决策");
}

export function list(input: CloudMusicListInput): CloudMusicListResult {
  const result: StoreListResult = listCloudMusicTracks(input);
  return {
    items: result.items.map(toCloudMusicTrackDto),
    total: result.total,
    offset: result.offset,
    limit: result.limit,
  };
}

export function getAdminDetail(uuid: string): CloudMusicTrackDto | null {
  const track = readCloudMusicTrack(uuid, false);
  return track ? toCloudMusicTrackDto(track) : null;
}

export async function removeManualCover(uuid: string): Promise<CloudMusicTrackDto> {
  const track = readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  const uploadedCover = track.assets.find((item) => item.kind === "cover-uploaded" && item.state === "uploaded" && item.isCurrent && item.deletedAt === null);
  if (!uploadedCover) return toCloudMusicTrackDto(track);

  const file = readFileRecordById(uploadedCover.fileRecordId);
  if (file && file.status !== "deleted") {
    await deleteCloudMusicAsset({ bucket: file.bucket, objectKey: file.objectKey }).catch(() => undefined);
  }

  const db = getAppDb();
  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`UPDATE cloud_music_assets SET state = 'deleted', is_current = 0, deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, uploadedCover.id);
    db.prepare(`UPDATE file_records SET status = 'deleted', referenced_by = '[]', deleted_at = ? WHERE id = ?`).run(now, uploadedCover.fileRecordId);
    db.prepare(`
      UPDATE cloud_music_assets
      SET is_current = 1, updated_at = ?
      WHERE track_uuid = ? AND kind = 'cover-extracted' AND state = 'uploaded' AND deleted_at IS NULL
    `).run(now, uuid);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const updated = readCloudMusicTrack(uuid);
  if (!updated) throw new Error("刷新曲目状态失败");
  return toCloudMusicTrackDto(updated);
}

export async function deleteCloudMusic(uuid: string): Promise<CloudMusicTrackDto> {
  const track = readCloudMusicTrack(uuid, true);
  if (!track) throw new Error("网盘音乐曲目不存在");

  for (const asset of track.assets) {
    if (asset.deletedAt === null) {
      const file = readFileRecordById(asset.fileRecordId);
      if (file && file.status !== "deleted") {
        await deleteCloudMusicAsset({ bucket: file.bucket, objectKey: file.objectKey }).catch(() => undefined);
      }
    }
  }

  const deleted = markCloudMusicDeleted(uuid, Date.now());
  if (!deleted) throw new Error("删除网盘音乐记录失败");
  return toCloudMusicTrackDto(deleted);
}

export function preview(uuid: string): CloudMusicResourceUrls {
  const track = readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  const audioAsset = track.assets.find((item) => item.kind === "audio" && item.state === "uploaded" && item.deletedAt === null);
  if (!audioAsset) throw new Error("音频文件尚未上传，无法试听");

  const audioFile = readFileRecordById(audioAsset.fileRecordId);
  if (!audioFile || audioFile.status !== "uploaded") throw new Error("音频文件记录状态不正确");

  const audioUrl = createCloudMusicAssetUrl(audioFile, 3600);
  const dto = toCloudMusicTrackDto(track);

  let lyricsUrl: string | null = null;
  const lyricsAsset = track.assets.find((item) => item.kind === "lyrics" && item.state === "uploaded" && item.deletedAt === null);
  if (lyricsAsset) {
    const lyricsFile = readFileRecordById(lyricsAsset.fileRecordId);
    if (lyricsFile && lyricsFile.status === "uploaded") {
      lyricsUrl = createCloudMusicAssetUrl(lyricsFile, 3600);
    }
  }

  const now = Date.now();
  return {
    audioUrl,
    audioExpiresAt: now + 3600 * 1000,
    coverUrl: dto.cover.url,
    lyricsUrl,
    lyricsExpiresAt: lyricsUrl ? now + 3600 * 1000 : null,
  };
}

export async function cleanupTemp(input: CloudMusicTempCleanupInput): Promise<CloudMusicTempCleanupResult> {
  const threshold = input.olderThanHours === 0 ? Date.now() : Date.now() - input.olderThanHours * 3600 * 1000;
  const staleTracks = listStaleTempTracks(threshold, 500);

  let deletedCount = 0;
  const failed: Array<{ uuid: string; message: string }> = [];

  for (const track of staleTracks) {
    try {
      await deleteCloudMusic(track.uuid);
      deletedCount += 1;
    } catch (err) {
      failed.push({
        uuid: track.uuid,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    scanned: staleTracks.length,
    deleted: deletedCount,
    failed,
  };
}

export function getTempSummary(): CloudMusicTempSummary {
  const db = getAppDb();
  const now = Date.now();
  const h24 = now - 24 * 3600 * 1000;
  const h72 = now - 72 * 3600 * 1000;

  const totalRow = db.prepare(`
    SELECT COUNT(DISTINCT t.uuid) AS count, COALESCE(SUM(f.file_size), 0) AS bytes
    FROM cloud_music_tracks t
    LEFT JOIN cloud_music_assets a ON a.track_uuid = t.uuid AND a.deleted_at IS NULL
    LEFT JOIN file_records f ON f.id = a.file_record_id AND f.status <> 'deleted'
    WHERE t.status = 'temp' AND t.deleted_at IS NULL
  `).get() as { count: number; bytes: number };

  const h24Row = db.prepare(`
    SELECT COUNT(DISTINCT t.uuid) AS count, COALESCE(SUM(f.file_size), 0) AS bytes
    FROM cloud_music_tracks t
    LEFT JOIN cloud_music_assets a ON a.track_uuid = t.uuid AND a.deleted_at IS NULL
    LEFT JOIN file_records f ON f.id = a.file_record_id AND f.status <> 'deleted'
    WHERE t.status = 'temp' AND t.deleted_at IS NULL AND t.created_at < ?
  `).get(h24) as { count: number; bytes: number };

  const h72Row = db.prepare(`
    SELECT COUNT(DISTINCT t.uuid) AS count, COALESCE(SUM(f.file_size), 0) AS bytes
    FROM cloud_music_tracks t
    LEFT JOIN cloud_music_assets a ON a.track_uuid = t.uuid AND a.deleted_at IS NULL
    LEFT JOIN file_records f ON f.id = a.file_record_id AND f.status <> 'deleted'
    WHERE t.status = 'temp' AND t.deleted_at IS NULL AND t.created_at < ?
  `).get(h72) as { count: number; bytes: number };

  const staleAssetsRow = db.prepare(`
    SELECT COUNT(a.id) AS count, COALESCE(SUM(f.file_size), 0) AS bytes
    FROM cloud_music_assets a
    JOIN file_records f ON f.id = a.file_record_id
    WHERE a.state IN ('pending', 'superseded')
      AND a.deleted_at IS NULL
      AND a.created_at < ?
      AND f.status <> 'deleted'
  `).get(h24) as { count: number; bytes: number };

  return {
    total: { count: Number(totalRow.count) || 0, bytes: Number(totalRow.bytes) || 0 },
    olderThan24h: { count: Number(h24Row.count) || 0, bytes: Number(h24Row.bytes) || 0 },
    olderThan72h: { count: Number(h72Row.count) || 0, bytes: Number(h72Row.bytes) || 0 },
    staleAssets: { count: Number(staleAssetsRow.count) || 0, bytes: Number(staleAssetsRow.bytes) || 0 },
  };
}

export function searchPublicTracks(input: CloudMusicSearchInput): CloudMusicSearchResponse {
  const result = searchVisibleCloudMusic(input);
  return {
    source: "cloud",
    items: result.items.map(toCloudMusicTrackDto).map(toCloudMusicPublicTrack),
    total: result.total,
    offset: result.offset,
    limit: result.limit,
  };
}

export function getPublicTrackDetail(uuid: string): CloudMusicPublicTrack | null {
  const track = readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) return null;
  if (track.status !== "active" && track.status !== "disabled") return null;
  return toCloudMusicPublicTrack(toCloudMusicTrackDto(track));
}

export function getPublicPlayUrl(uuid: string): CloudMusicPlayUrlResponse {
  const track = readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) {
    const err = new Error("曲目不存在");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }
  if (track.status === "disabled") {
    const err = new Error("曲目已禁用");
    (err as unknown as { statusCode: number; code: string }).statusCode = 403;
    (err as unknown as { code: string }).code = "CLOUD_MUSIC_DISABLED";
    throw err;
  }
  if (track.status !== "active") {
    const err = new Error("曲目不可播放");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const audioAsset = track.assets.find((item) => item.kind === "audio" && item.state === "uploaded" && item.isCurrent && item.deletedAt === null);
  if (!audioAsset) {
    const err = new Error("音频文件未就绪");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const audioFile = readFileRecordById(audioAsset.fileRecordId);
  if (!audioFile || audioFile.status !== "uploaded") {
    const err = new Error("音频文件不存在");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const url = createCloudMusicAssetUrl(audioFile, 3600);
  return {
    uuid,
    source: "cloud",
    url,
    expiresAt: Date.now() + 3600 * 1000,
  };
}

export function getPublicLyricsUrl(uuid: string): CloudMusicLyricsUrlResponse {
  const track = readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) {
    const err = new Error("曲目不存在");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }
  if (track.status === "disabled") {
    const err = new Error("曲目已禁用");
    (err as unknown as { statusCode: number; code: string }).statusCode = 403;
    (err as unknown as { code: string }).code = "CLOUD_MUSIC_DISABLED";
    throw err;
  }
  if (track.status !== "active") {
    const err = new Error("曲目当前不可用");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const lyricsAsset = track.assets.find((item) => item.kind === "lyrics" && item.state === "uploaded" && item.isCurrent && item.deletedAt === null);
  if (!lyricsAsset) {
    const err = new Error("该曲目暂无歌词");
    (err as unknown as { statusCode: number; code: string }).statusCode = 404;
    (err as unknown as { code: string }).code = "CLOUD_MUSIC_NO_LYRICS";
    throw err;
  }

  const lyricsFile = readFileRecordById(lyricsAsset.fileRecordId);
  if (!lyricsFile || lyricsFile.status !== "uploaded") {
    const err = new Error("歌词文件不存在");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const url = createCloudMusicAssetUrl(lyricsFile, 3600);
  return {
    uuid,
    source: "cloud",
    url,
    expiresAt: Date.now() + 3600 * 1000,
  };
}
