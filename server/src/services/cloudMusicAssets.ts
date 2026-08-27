import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  confirmCloudMusicAsset,
  readCloudMusicTrack,
  reserveCloudMusicAsset,
  type CloudMusicAssetKind,
  type CloudMusicReservedAsset,
} from "../db/cloudMusicStore";
import { readFileRecordById } from "../db/configStore";
import {
  createFixedQiniuUploadToken,
  createPrivateQiniuDownloadUrlForBucket,
  deleteQiniuObject,
  statQiniuObject,
  uploadQiniuBuffer,
  type QiniuObjectStat,
  type QiniuUploadTokenInfo,
} from "./qiniuReleaseFiles";

export const CLOUD_MUSIC_AUDIO_MAX_SIZE = 500 * 1024 * 1024;
export const CLOUD_MUSIC_COVER_MAX_SIZE = 10 * 1024 * 1024;
export const CLOUD_MUSIC_LYRICS_MAX_SIZE = 2 * 1024 * 1024;
export const CLOUD_MUSIC_DEFAULT_COVER_PATH = "/static/cloud-music/default-cover.svg";

const ASSET_MAX_SIZES: Record<CloudMusicAssetKind, number> = {
  audio: CLOUD_MUSIC_AUDIO_MAX_SIZE,
  "cover-uploaded": CLOUD_MUSIC_COVER_MAX_SIZE,
  "cover-extracted": CLOUD_MUSIC_COVER_MAX_SIZE,
  lyrics: CLOUD_MUSIC_LYRICS_MAX_SIZE,
};

export type CloudMusicCoverMimeType = "image/jpeg" | "image/png" | "image/webp";

const COVER_MIME_EXTENSIONS: Record<CloudMusicCoverMimeType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export type CloudMusicFileLocation = {
  bucket: string;
  objectKey: string;
};

export type CloudMusicFileInfo = CloudMusicFileLocation & {
  assetId: string;
  fileRecordId: string;
  trackUuid: string;
  kind: CloudMusicAssetKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
  hash: string;
};

export type ExtractedCoverUploadInput = {
  uuid: string;
  data: Buffer;
  mimeType: string;
};

function normalizeMimeType(value: string): string {
  const normalized = value.split(";", 1)[0].trim().toLowerCase();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

function isCoverMimeType(value: string): value is CloudMusicCoverMimeType {
  return Object.prototype.hasOwnProperty.call(COVER_MIME_EXTENSIONS, value);
}

function requireSafeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (!/^\.[a-z0-9]{1,10}$/.test(ext)) throw new Error("网盘音乐文件扩展名不正确");
  return ext;
}

function monthStamp(date = new Date()): string {
  return date.toISOString().slice(0, 7).replace("-", "");
}

export function buildCloudMusicAssetObjectKey(
  uuid: string,
  kind: CloudMusicAssetKind,
  fileName: string,
  date = new Date(),
): string {
  if (!uuid.trim() || /[\\/]/.test(uuid)) throw new Error("网盘音乐 UUID 不正确");
  const ext = requireSafeExtension(fileName);
  const baseName: Record<CloudMusicAssetKind, string> = {
    audio: "audio",
    "cover-uploaded": "cover-uploaded",
    "cover-extracted": "cover-embedded",
    lyrics: "lyrics",
  };
  return `pisamusic/cloud-music/${monthStamp(date)}/${uuid}/${baseName[kind]}${ext}`;
}

function validateAssetDeclaration(asset: CloudMusicReservedAsset): void {
  const maxSize = ASSET_MAX_SIZES[asset.kind];
  if (!Number.isSafeInteger(asset.fileSize) || asset.fileSize <= 0) throw new Error("网盘音乐资产声明大小不正确");
  if (asset.fileSize > maxSize) {
    const label = asset.kind === "audio" ? "音频" : asset.kind === "lyrics" ? "歌词" : "封面";
    throw new Error(`${label}文件超过大小限制`);
  }
  const mimeType = normalizeMimeType(asset.mimeType);
  if (!mimeType) throw new Error("网盘音乐资产 MIME 不能为空");
  if ((asset.kind === "cover-uploaded" || asset.kind === "cover-extracted") && !isCoverMimeType(mimeType)) {
    throw new Error("封面仅支持 JPEG、PNG、WebP");
  }
  if (asset.kind === "audio" && !mimeType.startsWith("audio/")) throw new Error("音频 MIME 不正确");
  if (asset.kind === "cover-extracted") return;
  const parts = asset.objectKey.split("/");
  const ext = requireSafeExtension(asset.fileName);
  const expectedBaseName: Record<Exclude<CloudMusicAssetKind, "cover-extracted">, string> = {
    audio: "audio",
    "cover-uploaded": "cover-uploaded",
    lyrics: "lyrics",
  };
  if (
    parts.length !== 5
    || parts[0] !== "pisamusic"
    || parts[1] !== "cloud-music"
    || !/^\d{4}(0[1-9]|1[0-2])$/.test(parts[2])
    || parts[3] !== asset.trackUuid
    || parts[4] !== `${expectedBaseName[asset.kind]}${ext}`
  ) throw new Error("网盘音乐资产 Key 与预登记信息不一致");
}

function readVerifiedPendingAsset(uuid: string, asset: CloudMusicReservedAsset): CloudMusicReservedAsset {
  if (uuid !== asset.trackUuid) throw new Error("网盘音乐资产不属于当前曲目");
  if (asset.state !== "pending" || asset.fileStatus !== "pending" || asset.deletedAt !== null) {
    throw new Error("只有 pending 资产可以签发上传凭证");
  }
  const track = readCloudMusicTrack(uuid);
  const registeredAsset = track?.assets.find((item) => item.id === asset.id && item.fileRecordId === asset.fileRecordId);
  if (!track || track.status !== "temp" || !registeredAsset || registeredAsset.state !== "pending") {
    throw new Error("只有 temp 曲目的 pending 资产可以签发上传凭证");
  }
  const file = readFileRecordById(asset.fileRecordId);
  if (
    !file
    || file.usageType !== "cloud-music"
    || file.status !== "pending"
    || file.deletedAt !== null
    || file.bucket !== asset.bucket
    || file.objectKey !== asset.objectKey
    || file.fileName !== asset.fileName
    || file.fileSize !== asset.fileSize
    || normalizeMimeType(file.mimeType) !== normalizeMimeType(asset.mimeType)
  ) {
    throw new Error("网盘音乐预登记文件信息不一致");
  }
  validateAssetDeclaration(asset);
  return asset;
}

export function createCloudMusicAssetUploadToken(input: {
  uuid: string;
  asset: CloudMusicReservedAsset;
}): QiniuUploadTokenInfo {
  const asset = readVerifiedPendingAsset(input.uuid, input.asset);
  if (asset.kind === "cover-extracted") throw new Error("内嵌封面只能由服务端上传");
  return createFixedQiniuUploadToken({
    bucket: asset.bucket,
    key: asset.objectKey,
    fileSize: asset.fileSize,
    mimeType: normalizeMimeType(asset.mimeType),
  });
}

export async function statCloudMusicAsset(asset: CloudMusicReservedAsset): Promise<QiniuObjectStat> {
  readVerifiedPendingAsset(asset.trackUuid, asset);
  const stat = await statQiniuObject(asset.bucket, asset.objectKey);
  if (stat.fileSize !== asset.fileSize) throw new Error("七牛对象真实大小与预登记不一致");
  if (normalizeMimeType(stat.mimeType) !== normalizeMimeType(asset.mimeType)) {
    throw new Error("七牛对象 MIME 与预登记不一致");
  }
  return stat;
}

export async function deleteCloudMusicAsset(asset: CloudMusicFileLocation): Promise<void> {
  await deleteQiniuObject(asset.bucket, asset.objectKey);
}

export function createCloudMusicAssetUrl(asset: CloudMusicFileLocation, ttlSeconds: number): string {
  return createPrivateQiniuDownloadUrlForBucket(asset.bucket, asset.objectKey, ttlSeconds);
}

export function detectCoverMimeType(data: Uint8Array): CloudMusicCoverMimeType | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (
    data.length >= 8
    && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
    && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a
  ) return "image/png";
  if (
    data.length >= 12
    && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) return "image/webp";
  return null;
}

export async function uploadExtractedCover(input: ExtractedCoverUploadInput): Promise<CloudMusicFileInfo> {
  const track = readCloudMusicTrack(input.uuid);
  if (!track || track.status !== "temp") throw new Error("只有 temp 曲目可以登记内嵌封面");
  const mimeType = normalizeMimeType(input.mimeType);
  const detectedMimeType = detectCoverMimeType(input.data);
  if (!isCoverMimeType(mimeType) || !detectedMimeType || detectedMimeType !== mimeType) {
    throw new Error("内嵌封面格式或文件头不正确");
  }
  if (input.data.byteLength <= 0 || input.data.byteLength > CLOUD_MUSIC_COVER_MAX_SIZE) {
    throw new Error("内嵌封面不能超过 10 MiB");
  }
  const ext = COVER_MIME_EXTENSIONS[mimeType];
  const fileName = `cover-embedded${ext}`;
  const bucket = String(process.env.QINIU_BUCKET ?? "").trim();
  if (!bucket) throw new Error("缺少七牛配置：QINIU_BUCKET");
  const reserved = reserveCloudMusicAsset({
    trackUuid: input.uuid,
    assetId: randomUUID(),
    fileRecordId: randomUUID(),
    kind: "cover-extracted",
    bucket,
    objectKey: buildCloudMusicAssetObjectKey(input.uuid, "cover-extracted", fileName),
    fileName,
    mimeType,
    fileSize: input.data.byteLength,
  });
  const stat = await uploadQiniuBuffer({
    bucket: reserved.bucket,
    key: reserved.objectKey,
    data: input.data,
    fileSize: reserved.fileSize,
    mimeType,
  });
  if (stat.fileSize !== reserved.fileSize || normalizeMimeType(stat.mimeType) !== mimeType) {
    throw new Error("内嵌封面上传结果与预登记不一致");
  }
  confirmCloudMusicAsset({
    fileRecordId: reserved.fileRecordId,
    hash: stat.hash,
    mimeType: stat.mimeType,
    fileSize: stat.fileSize,
  });
  return {
    assetId: reserved.id,
    fileRecordId: reserved.fileRecordId,
    trackUuid: reserved.trackUuid,
    kind: reserved.kind,
    bucket: reserved.bucket,
    objectKey: reserved.objectKey,
    fileName: reserved.fileName,
    mimeType: stat.mimeType,
    fileSize: stat.fileSize,
    hash: stat.hash,
  };
}
