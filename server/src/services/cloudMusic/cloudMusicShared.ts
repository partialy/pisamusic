import { randomUUID } from "node:crypto";
import { getAppDb } from "../../db/appDb";
import {
  confirmCloudMusicAsset,
  createCloudMusicUploadSession as dbCreateUploadSession,
  readCloudMusicReservedAsset,
  readCloudMusicTrack,
  type CloudMusicAsset,
  type CloudMusicAssetKind,
  type CloudMusicTrack as StoreTrack,
} from "../../db/cloudMusicStore";
import { readFileRecordById } from "../../db/configStore";
import {
  buildCloudMusicAssetObjectKey,
  CLOUD_MUSIC_DEFAULT_COVER_PATH,
  createCloudMusicAssetUploadToken,
  createCloudMusicAssetReadUrl,
  createCloudMusicAssetUrl,
  getCloudMusicLyricsFormat,
  inferAssetMimeType,
  requireCloudMusicAssetExtension,
  statCloudMusicAsset,
  uploadExtractedCover,
  type CloudMusicFileInfo,
} from "../cloudMusicAssets";
import {
  extractCloudMusicMetadata,
  readCloudMusicCoverMimeType,
} from "../cloudMusicMetadata";
import { updateQiniuObjectMimeType } from "../qiniuReleaseFiles";
import type {
  CloudMusicAssetUploadTicket,
  CloudMusicOwner,
  CloudMusicPublicTrack,
  CloudMusicTrackDto,
  CloudMusicUploadSession,
  CloudMusicUploadSessionRequest,
} from "./types";

export function getRequiredBucket(): string {
  const bucket = String(process.env.QINIU_BUCKET ?? "").trim();
  if (!bucket) throw new Error("缺少七牛配置：QINIU_BUCKET");
  return bucket;
}

export function findCurrentAsset(assets: CloudMusicAsset[], kind: CloudMusicAssetKind): CloudMusicAsset | null {
  const current = assets.find((item) => item.kind === kind && item.isCurrent && item.state === "uploaded" && item.deletedAt === null);
  if (current) return current;
  return assets.find((item) => item.kind === kind && item.state === "uploaded" && item.deletedAt === null) ?? null;
}

export async function resolveFileInfo(asset: CloudMusicAsset | null): Promise<CloudMusicFileInfo | null> {
  if (!asset) return null;
  const file = await readFileRecordById(asset.fileRecordId);
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

export async function toCloudMusicTrackDto(track: StoreTrack): Promise<CloudMusicTrackDto> {
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
    const file = await readFileRecordById(uploadedCoverAsset.fileRecordId);
    if (file && file.status === "uploaded") {
      cover = {
        source: "uploaded",
        url: createCloudMusicAssetUrl(file, 3600),
      };
    }
  } else if (extractedCoverAsset) {
    const file = await readFileRecordById(extractedCoverAsset.fileRecordId);
    if (file && file.status === "uploaded") {
      cover = {
        source: "embedded",
        url: createCloudMusicAssetUrl(file, 3600),
      };
    }
  }

  let lyrics: CloudMusicTrackDto["lyrics"] = null;
  if (lyricsAsset) {
    const file = await readFileRecordById(lyricsAsset.fileRecordId);
    if (file && file.status === "uploaded") {
      lyrics = {
        format: getCloudMusicLyricsFormat(file.fileName, track.lyricsFormat),
        fileName: file.fileName,
      };
    }
  }

  const audioFile = await resolveFileInfo(audioAsset);
  const playable = track.status === "active" && track.uploadState === "ready" && audioFile !== null && audioFile.fileSize > 0;

  let owner: CloudMusicOwner = { type: "system", userId: null, displayName: "system" };
  if (audioAsset) {
    const file = await readFileRecordById(audioAsset.fileRecordId);
    if (file && file.ownerType === "user" && file.ownerUserId) {
      const displayName = typeof file.ownerSnapshot?.username === "string" && file.ownerSnapshot.username.trim()
        ? file.ownerSnapshot.username.trim()
        : typeof file.ownerSnapshot?.displayName === "string" && file.ownerSnapshot.displayName.trim()
        ? file.ownerSnapshot.displayName.trim()
        : `用户${file.ownerUserId}`;
      owner = {
        type: "user",
        userId: file.ownerUserId,
        displayName,
      };
    }
  }

  return {
    uuid: track.uuid,
    source: "cloud",
    owner,
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
    cover: {
      source: dto.cover.source,
      url: `/api/cloud-music/tracks/${encodeURIComponent(dto.uuid)}/cover`,
    },
    lyrics: dto.lyrics,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export async function createUploadSessionInternal(
  input: CloudMusicUploadSessionRequest,
  owner?: { type: "system" | "user"; userId?: string | null; snapshot?: Record<string, unknown> },
): Promise<CloudMusicUploadSession> {
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

  const track = await dbCreateUploadSession({
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
    owner,
  });

  const tickets: CloudMusicAssetUploadTicket[] = [];

  const audioReserved = await readCloudMusicReservedAsset(audioFileRecordId);
  if (!audioReserved) throw new Error("音频资产预登记失败");
  const audioTicket = await createCloudMusicAssetUploadToken({ uuid, asset: audioReserved });
  tickets.push({
    assetId: audioAssetId,
    fileRecordId: audioFileRecordId,
    kind: "audio",
    key: audioObjectKey,
    uploadToken: audioTicket.uploadToken,
    uploadUrl: audioTicket.uploadUrl,
  });

  if (coverAssetInput) {
    const coverReserved = await readCloudMusicReservedAsset(coverAssetInput.fileRecordId);
    if (!coverReserved) throw new Error("封面资产预登记失败");
    const coverTicket = await createCloudMusicAssetUploadToken({ uuid, asset: coverReserved });
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
    const lyricsReserved = await readCloudMusicReservedAsset(lyricsAssetInput.fileRecordId);
    if (!lyricsReserved) throw new Error("歌词资产预登记失败");
    const lyricsTicket = await createCloudMusicAssetUploadToken({ uuid, asset: lyricsReserved });
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
    track: await toCloudMusicTrackDto(track),
    tickets,
  };
}

export async function confirmAsset(uuid: string, kind: CloudMusicAssetKind): Promise<CloudMusicTrackDto> {
  const track = await readCloudMusicTrack(uuid, true);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  const pendingAsset = track.assets.find((item) => item.kind === kind && item.state === "pending" && item.deletedAt === null);

  if (!pendingAsset) {
    const currentAsset = track.assets.find((item) => item.kind === kind && item.state === "uploaded" && item.isCurrent && item.deletedAt === null);
    if (currentAsset) {
      return await toCloudMusicTrackDto(track);
    }
    throw new Error(`未找到待确认的 ${kind} 资产记录`);
  }

  const reserved = await readCloudMusicReservedAsset(pendingAsset.fileRecordId);
  if (!reserved) throw new Error(`待确认的 ${kind} 预登记资产不存在`);

  const stat = await statCloudMusicAsset(reserved);

  if (kind === "audio") {
    const db = getAppDb();
    await db.execute(`UPDATE cloud_music_tracks SET upload_state = 'processing', updated_at = ? WHERE uuid = ?`, [Date.now(), uuid]);
    const signedUrl = createCloudMusicAssetReadUrl(reserved, 300);

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

      const updated = await confirmCloudMusicAsset({
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
      return await toCloudMusicTrackDto(updated);
    } catch (parseError) {
      const reason = parseError instanceof Error ? parseError.message : String(parseError);
      await confirmCloudMusicAsset({
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
    const signedUrl = createCloudMusicAssetReadUrl(reserved, 300);
    const mimeType = await readCloudMusicCoverMimeType({
      signedUrl,
      fileName: reserved.fileName,
      expectedSize: stat.fileSize,
    });
    if (stat.mimeType !== mimeType) await updateQiniuObjectMimeType(reserved.bucket, reserved.objectKey, mimeType);
    const updated = await confirmCloudMusicAsset({
      fileRecordId: reserved.fileRecordId,
      hash: stat.hash,
      mimeType,
      fileSize: stat.fileSize,
    });
    return await toCloudMusicTrackDto(updated);
  }

  if (kind === "lyrics") {
    const updated = await confirmCloudMusicAsset({
      fileRecordId: reserved.fileRecordId,
      hash: stat.hash,
      mimeType: stat.mimeType,
      fileSize: stat.fileSize,
      parsed: {
        lyricsFormat: getCloudMusicLyricsFormat(reserved.fileName),
      },
    });
    return await toCloudMusicTrackDto(updated);
  }

  throw new Error(`不支持的资产类型确认: ${kind}`);
}
