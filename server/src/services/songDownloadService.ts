import type { DeviceMessageIdentity } from "../middleware/deviceMessageToken";
import type { PublicUser } from "../db/userStore";
import {
  acquireDownloadQuotaTx,
  getDownloadQuotaSnapshot,
  type SongDownloadAcquireItemInput,
  type SongDownloadAcquireResult,
  type SongDownloadPlatform,
  type SongDownloadQuotaSnapshot,
  type SongDownloadSource,
  type SongDownloadSubjectType,
} from "../db/songDownloadStore";

export class SongDownloadValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "SongDownloadValidationError";
    this.statusCode = statusCode;
  }
}

const VALID_SOURCES = new Set<SongDownloadSource>(["kg", "wy", "kw", "cloud"]);
const CLIENT_BATCH_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_BATCH_ITEMS = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clipText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  return text.length <= max ? text : text.slice(0, max);
}

function resolveSubject(
  deviceIdentity: DeviceMessageIdentity,
  user: PublicUser | null,
): { subjectType: SongDownloadSubjectType; subjectKey: string } {
  if (user) {
    return { subjectType: "user", subjectKey: user.id };
  }
  return {
    subjectType: "device",
    subjectKey: `${deviceIdentity.kind}:${deviceIdentity.deviceId}`,
  };
}

export async function acquireSongDownloads(params: {
  deviceIdentity: DeviceMessageIdentity;
  user: PublicUser | null;
  clientIp: string;
  body: unknown;
}): Promise<SongDownloadAcquireResult> {
  if (!isRecord(params.body)) {
    throw new SongDownloadValidationError("请求体必须是对象");
  }

  const clientBatchId = clipText(params.body.clientBatchId, 128);
  if (!CLIENT_BATCH_ID_RE.test(clientBatchId)) {
    throw new SongDownloadValidationError("clientBatchId 格式不正确");
  }

  const rawPlatform = params.body.platform;
  if (rawPlatform !== "android" && rawPlatform !== "desktop") {
    throw new SongDownloadValidationError("platform 必须是 android 或 desktop");
  }
  const platform: SongDownloadPlatform = rawPlatform;
  if (platform !== params.deviceIdentity.kind) {
    throw new SongDownloadValidationError("platform 与设备令牌类型不匹配");
  }

  if (!Array.isArray(params.body.items) || params.body.items.length === 0 || params.body.items.length > MAX_BATCH_ITEMS) {
    throw new SongDownloadValidationError(`items 数量必须在 1 到 ${MAX_BATCH_ITEMS} 之间`);
  }

  const items: SongDownloadAcquireItemInput[] = [];
  for (let i = 0; i < params.body.items.length; i++) {
    const raw = params.body.items[i];
    if (!isRecord(raw)) {
      throw new SongDownloadValidationError(`items[${i}] 必须是对象`);
    }
    const source = clipText(raw.source, 32) as SongDownloadSource;
    if (!VALID_SOURCES.has(source)) {
      throw new SongDownloadValidationError(`items[${i}].source 不受支持`);
    }
    const songId = clipText(raw.songId, 191);
    if (!songId) {
      throw new SongDownloadValidationError(`items[${i}].songId 不能为空`);
    }
    const qualityKey = clipText(raw.qualityKey, 64);
    if (!qualityKey) {
      throw new SongDownloadValidationError(`items[${i}].qualityKey 不能为空`);
    }
    const name = clipText(raw.name, 512) || "未知歌曲";
    const singer = clipText(raw.singer, 512);
    const album = clipText(raw.album, 512);
    const cover = clipText(raw.cover, 2048);
    let durationMs: number | null = null;
    if (raw.durationMs !== undefined && raw.durationMs !== null) {
      const parsedDuration = Number(raw.durationMs);
      if (Number.isFinite(parsedDuration) && parsedDuration >= 0) {
        durationMs = Math.trunc(parsedDuration);
      }
    }

    items.push({
      source,
      songId,
      name,
      singer,
      album,
      cover,
      durationMs,
      qualityKey,
    });
  }

  const subject = resolveSubject(params.deviceIdentity, params.user);
  return acquireDownloadQuotaTx({
    clientBatchId,
    subjectType: subject.subjectType,
    subjectKey: subject.subjectKey,
    userId: params.user?.id ?? null,
    deviceKind: params.deviceIdentity.kind,
    deviceId: params.deviceIdentity.deviceId,
    platform,
    clientIp: clipText(params.clientIp, 128),
    items,
  });
}

export async function queryCurrentSongDownloadQuota(params: {
  deviceIdentity: DeviceMessageIdentity;
  user: PublicUser | null;
}): Promise<SongDownloadQuotaSnapshot> {
  const subject = resolveSubject(params.deviceIdentity, params.user);
  return getDownloadQuotaSnapshot(subject.subjectType, subject.subjectKey);
}
