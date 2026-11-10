import path from "node:path";
import { type DbClient as DatabaseSync } from "./core/types";
import { getAppDb } from "./appDb";

export type CloudMusicStatus = "temp" | "active" | "disabled" | "offline" | "pending_review" | "rejected" | "deleted";
export type CloudMusicUploadState = "reserved" | "uploaded" | "processing" | "ready" | "failed";
export type CloudMusicAssetKind = "audio" | "cover-uploaded" | "cover-extracted" | "lyrics";
export type CloudMusicAssetState = "pending" | "uploaded" | "superseded" | "deleted";

export type CloudMusicAsset = {
  id: string;
  trackUuid: string;
  fileRecordId: string;
  kind: CloudMusicAssetKind;
  state: CloudMusicAssetState;
  isCurrent: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type CloudMusicTrack = {
  uuid: string;
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
  lyricsFormat: string | null;
  metadata: Record<string, unknown>;
  reviewedBy: string;
  reviewedAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  assets: CloudMusicAsset[];
};

export type CloudMusicAssetReserveInput = {
  trackUuid: string;
  assetId: string;
  fileRecordId: string;
  kind: CloudMusicAssetKind;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  ownerType?: "system" | "user";
  ownerUserId?: string | null;
  ownerSnapshot?: Record<string, unknown>;
};

type SessionAssetInput = Omit<CloudMusicAssetReserveInput, "trackUuid" | "kind" | "ownerType" | "ownerUserId" | "ownerSnapshot">;

export type CloudMusicSessionCreateInput = {
  uuid: string;
  audio: SessionAssetInput;
  cover?: SessionAssetInput;
  lyrics?: SessionAssetInput;
  owner?: {
    type: "system" | "user";
    userId?: string | null;
    snapshot?: Record<string, unknown>;
  };
};

export type CloudMusicReservedAsset = CloudMusicAsset & {
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileStatus: "pending";
};

export type CloudMusicDraftUpdateInput = {
  status?: CloudMusicStatus;
  statusReason?: string;
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
  lyricsFormat?: string | null;
  metadata?: Record<string, unknown>;
};

export type CloudMusicAssetConfirmInput = {
  fileRecordId: string;
  hash: string;
  mimeType: string;
  fileSize: number;
  uploadState?: Exclude<CloudMusicUploadState, "reserved">;
  statusReason?: string;
  parsed?: CloudMusicDraftUpdateInput;
};

export type CloudMusicListInput = {
  status?: CloudMusicStatus | CloudMusicStatus[] | "all";
  uploadState?: CloudMusicUploadState;
  keyword?: string;
  includeDeleted?: boolean;
  offset?: number;
  limit?: number;
};

export type CloudMusicSearchInput = {
  keyword?: string;
  offset?: number;
  limit?: number;
};

export type CloudMusicPublicSummary = {
  total: number;
  latestUpdatedAt: number | null;
  myContributions: number;
};

export type CloudMusicListResult = {
  items: CloudMusicTrack[];
  total: number;
  offset: number;
  limit: number;
};

export type CloudMusicStatusTransitionInput = {
  uuid: string;
  status: Exclude<CloudMusicStatus, "deleted">;
  statusReason?: string;
  reviewedBy?: string;
  reviewedAt?: number | null;
};

type CloudMusicTrackRow = {
  uuid: string;
  status: string;
  upload_state: string;
  status_reason: string;
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  format: string;
  codec: string;
  bitrate: number;
  sample_rate: number;
  channels: number;
  year: number | null;
  track_no: number | null;
  lyrics_format: string | null;
  metadata_json: string;
  reviewed_by: string;
  reviewed_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

type CloudMusicAssetRow = {
  id: string;
  track_uuid: string;
  file_record_id: string;
  kind: string;
  state: string;
  is_current: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

type ReservedAssetRow = CloudMusicAssetRow & {
  bucket: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  file_size: number;
};

async function runInTransaction<T>(db: DatabaseSync, fn: () => Promise<T>): Promise<T> {
  return (await db.transaction(async () => {
    const result = (await fn());

    return result;
  }));
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function mapAsset(row: CloudMusicAssetRow): CloudMusicAsset {
  return {
    id: row.id,
    trackUuid: row.track_uuid,
    fileRecordId: row.file_record_id,
    kind: row.kind as CloudMusicAssetKind,
    state: row.state as CloudMusicAssetState,
    isCurrent: row.is_current === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

async function readAssets(db: DatabaseSync, trackUuid: string, includeDeleted: boolean): Promise<CloudMusicAsset[]> {
  const where = includeDeleted ? "track_uuid = ?" : "track_uuid = ? AND deleted_at IS NULL";
  const rows = (await db.query(`SELECT * FROM cloud_music_assets WHERE ${where} ORDER BY created_at ASC, id ASC`, [trackUuid])) as CloudMusicAssetRow[];
  return rows.map(mapAsset);
}

async function mapTrack(db: DatabaseSync, row: CloudMusicTrackRow, includeDeleted = false): Promise<CloudMusicTrack> {
  return {
    uuid: row.uuid,
    status: row.status as CloudMusicStatus,
    uploadState: row.upload_state as CloudMusicUploadState,
    statusReason: row.status_reason,
    title: row.title,
    artist: row.artist,
    album: row.album,
    durationMs: row.duration_ms,
    format: row.format,
    codec: row.codec,
    bitrate: row.bitrate,
    sampleRate: row.sample_rate,
    channels: row.channels,
    year: row.year,
    trackNo: row.track_no,
    lyricsFormat: row.lyrics_format,
    metadata: parseMetadata(row.metadata_json),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    assets: (await readAssets(db, row.uuid, includeDeleted)),
  };
}

async function readTrackWithDb(db: DatabaseSync, uuid: string, includeDeleted = false): Promise<CloudMusicTrack | null> {
  const deletedClause = includeDeleted ? "" : "AND deleted_at IS NULL";
  const row = (await db.queryOne(`SELECT * FROM cloud_music_tracks WHERE uuid = ? ${deletedClause}`, [uuid])) as CloudMusicTrackRow | undefined;
  return row ? (await mapTrack(db, row, includeDeleted)) : null;
}

async function reserveAssetWithDb(db: DatabaseSync, input: CloudMusicAssetReserveInput, now: number): Promise<CloudMusicReservedAsset> {
  if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0) throw new Error("网盘音乐资产声明大小不正确");
  if (!input.mimeType.trim()) throw new Error("网盘音乐资产 MIME 不能为空");
  const track = (await db.queryOne("SELECT uuid FROM cloud_music_tracks WHERE uuid = ? AND deleted_at IS NULL", [input.trackUuid])) as { uuid: string } | undefined;
  if (!track) throw new Error("网盘音乐曲目不存在");

  const ownerType = input.ownerType ?? "system";
  const ownerUserId = input.ownerUserId ?? null;
  const ownerSnapshotJson = JSON.stringify(input.ownerSnapshot ?? { displayName: ownerType });

  (await db.execute(`INSERT INTO file_records (
      id, usage_type, owner_type, owner_user_id, owner_snapshot_json,
      platform, version, asset_type, provider, bucket, object_key, hash,
      file_name, mime_type, file_size, download_url, status, referenced_by, created_at, deleted_at
    ) VALUES (?, 'cloud-music', ?, ?, ?, 'server', '', ?, 'qiniu', ?, ?, '', ?, ?, ?, '', 'pending', ?, ?, NULL)`, [input.fileRecordId, ownerType, ownerUserId, ownerSnapshotJson, input.kind, input.bucket, input.objectKey, input.fileName, input.mimeType, input.fileSize, JSON.stringify([{ type: "cloud-music", id: input.trackUuid }]), now]));
  (await db.execute(`INSERT INTO cloud_music_assets (
      id, track_uuid, file_record_id, kind, state, is_current, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, NULL)`, [input.assetId, input.trackUuid, input.fileRecordId, input.kind, now, now]));

  const row = (await db.queryOne(`SELECT a.*, f.bucket, f.object_key, f.file_name, f.mime_type, f.file_size
     FROM cloud_music_assets a
     JOIN file_records f ON f.id = a.file_record_id
     WHERE a.id = ?`, [input.assetId])) as ReservedAssetRow | undefined;
  if (!row) throw new Error("网盘音乐资产预登记失败");
  return {
    ...mapAsset(row),
    provider: "qiniu",
    bucket: row.bucket,
    objectKey: row.object_key,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    fileStatus: "pending",
  };
}

async function updateDraftWithDb(db: DatabaseSync, uuid: string, input: CloudMusicDraftUpdateInput, now: number): Promise<void> {
  const assignments: string[] = [];
  const values: Array<string | number | null> = [];
  if (input.status !== undefined) {
    assignments.push("status = ?");
    values.push(input.status);
  }
  if (input.statusReason !== undefined) {
    assignments.push("status_reason = ?");
    values.push(input.statusReason);
  }
  const fields: Array<[keyof CloudMusicDraftUpdateInput, string]> = [
    ["title", "title"],
    ["artist", "artist"],
    ["album", "album"],
    ["durationMs", "duration_ms"],
    ["format", "format"],
    ["codec", "codec"],
    ["bitrate", "bitrate"],
    ["sampleRate", "sample_rate"],
    ["channels", "channels"],
    ["year", "year"],
    ["trackNo", "track_no"],
    ["lyricsFormat", "lyrics_format"],
  ];
  for (const [key, column] of fields) {
    if (input[key] !== undefined) {
      assignments.push(`${column} = ?`);
      values.push(input[key] as string | number | null);
    }
  }
  if (input.metadata !== undefined) {
    assignments.push("metadata_json = ?");
    values.push(JSON.stringify(input.metadata));
  }
  if (assignments.length === 0) return;
  assignments.push("updated_at = ?");
  values.push(now, uuid);
  (await db.execute(`UPDATE cloud_music_tracks SET ${assignments.join(", ")} WHERE uuid = ? AND deleted_at IS NULL`, [...values]));
}

function assertUploadTransition(current: CloudMusicUploadState, next: Exclude<CloudMusicUploadState, "reserved">): void {
  const allowed: Record<CloudMusicUploadState, CloudMusicUploadState[]> = {
    reserved: ["uploaded"],
    uploaded: ["uploaded", "processing"],
    processing: ["processing", "ready", "failed"],
    ready: ["ready"],
    failed: ["failed"],
  };
  if (!allowed[current].includes(next)) {
    throw new Error(`非法的网盘音乐上传状态迁移: ${current} -> ${next}`);
  }
}

export async function createCloudMusicUploadSession(input: CloudMusicSessionCreateInput): Promise<CloudMusicTrack> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => {
    const now = Date.now();
    const ownerType = input.owner?.type ?? "system";
    const ownerUserId = input.owner?.userId ?? null;
    const ownerSnapshot = input.owner?.snapshot ?? { displayName: ownerType };

    (await db.execute(`INSERT INTO cloud_music_tracks (
        uuid, status, upload_state, status_reason, title, artist, created_at, updated_at, deleted_at
      ) VALUES (?, 'temp', 'reserved', '', ?, '未知歌手', ?, ?, NULL)`, [input.uuid, path.basename(input.audio.fileName), now, now]));

    (await reserveAssetWithDb(db, {
      ...input.audio,
      trackUuid: input.uuid,
      kind: "audio",
      ownerType,
      ownerUserId,
      ownerSnapshot,
    }, now));

    if (input.cover) {
      (await reserveAssetWithDb(db, {
        ...input.cover,
        trackUuid: input.uuid,
        kind: "cover-uploaded",
        ownerType,
        ownerUserId,
        ownerSnapshot,
      }, now));
    }
    if (input.lyrics) {
      (await reserveAssetWithDb(db, {
        ...input.lyrics,
        trackUuid: input.uuid,
        kind: "lyrics",
        ownerType,
        ownerUserId,
        ownerSnapshot,
      }, now));
    }

    const track = (await readTrackWithDb(db, input.uuid));
    if (!track) throw new Error("网盘音乐上传会话创建失败");
    return track;
  }));
}

export async function readTrackOwnerInfo(uuid: string): Promise<{ ownerType: string; ownerUserId: string | null; ownerSnapshot: Record<string, unknown> } | null> {
  const db = getAppDb();
  const row = (await db.queryOne(`SELECT f.owner_type, f.owner_user_id, f.owner_snapshot_json
     FROM cloud_music_assets a
     JOIN file_records f ON f.id = a.file_record_id
     WHERE a.track_uuid = ? AND a.kind = 'audio' AND a.deleted_at IS NULL
     LIMIT 1`, [uuid])) as { owner_type: string; owner_user_id: string | null; owner_snapshot_json: string } | undefined;
  if (!row) return null;
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = JSON.parse(row.owner_snapshot_json);
  } catch {
    snapshot = {};
  }
  return {
    ownerType: row.owner_type,
    ownerUserId: row.owner_user_id,
    ownerSnapshot: snapshot,
  };
}

export async function reserveCloudMusicAsset(input: CloudMusicAssetReserveInput): Promise<CloudMusicReservedAsset> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => (await reserveAssetWithDb(db, input, Date.now()))));
}

export async function confirmCloudMusicAsset(input: CloudMusicAssetConfirmInput): Promise<CloudMusicTrack> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => {
    const now = Date.now();
    const asset = (await db.queryOne(`SELECT * FROM cloud_music_assets WHERE file_record_id = ? AND deleted_at IS NULL`, [input.fileRecordId])) as CloudMusicAssetRow | undefined;
    if (!asset) throw new Error("网盘音乐资产不存在");
    const trackRow = (await db.queryOne(`SELECT upload_state FROM cloud_music_tracks WHERE uuid = ? AND deleted_at IS NULL`, [asset.track_uuid])) as { upload_state: CloudMusicUploadState } | undefined;
    if (!trackRow) throw new Error("网盘音乐曲目不存在");
    const nextUploadState = asset.kind === "audio"
      ? input.uploadState ?? "uploaded"
      : trackRow.upload_state;
    if (asset.kind === "audio") assertUploadTransition(trackRow.upload_state, nextUploadState as Exclude<CloudMusicUploadState, "reserved">);

    (await db.execute(`UPDATE file_records
       SET hash = ?, mime_type = ?, file_size = ?, status = 'uploaded', deleted_at = NULL
       WHERE id = ? AND status <> 'deleted'`, [input.hash, input.mimeType, Math.max(0, Math.trunc(input.fileSize)), input.fileRecordId]));
    (await db.execute(`UPDATE cloud_music_assets
       SET state = 'superseded', is_current = 0, updated_at = ?
       WHERE track_uuid = ? AND kind = ? AND id <> ? AND is_current = 1 AND deleted_at IS NULL`, [now, asset.track_uuid, asset.kind, asset.id]));
    (await db.execute(`UPDATE cloud_music_assets
       SET state = 'uploaded', is_current = 1, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`, [now, asset.id]));
    if (asset.kind === "audio") {
      if (input.parsed) (await updateDraftWithDb(db, asset.track_uuid, input.parsed, now));
      (await db.execute(`UPDATE cloud_music_tracks
         SET upload_state = ?, status_reason = ?, updated_at = ?
         WHERE uuid = ? AND deleted_at IS NULL`, [nextUploadState, input.statusReason ?? "", now, asset.track_uuid]));
    }

    const track = (await readTrackWithDb(db, asset.track_uuid));
    if (!track) throw new Error("网盘音乐资产确认失败");
    return track;
  }));
}

export async function readCloudMusicTrack(uuid: string, includeDeleted = false): Promise<CloudMusicTrack | null> {
  return (await readTrackWithDb(getAppDb(), uuid, includeDeleted));
}

export async function readCloudMusicReservedAsset(fileRecordId: string): Promise<CloudMusicReservedAsset | null> {
  const row = (await getAppDb().queryOne(`SELECT a.*, f.bucket, f.object_key, f.file_name, f.mime_type, f.file_size
     FROM cloud_music_assets a
     JOIN cloud_music_tracks t ON t.uuid = a.track_uuid
     JOIN file_records f ON f.id = a.file_record_id
     WHERE a.file_record_id = ?
       AND a.state = 'pending'
       AND a.deleted_at IS NULL
       AND t.status = 'temp'
       AND t.deleted_at IS NULL
       AND f.status = 'pending'
       AND f.deleted_at IS NULL`, [fileRecordId])) as ReservedAssetRow | undefined;
  if (!row) return null;
  return {
    ...mapAsset(row),
    provider: "qiniu",
    bucket: row.bucket,
    objectKey: row.object_key,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    fileStatus: "pending",
  };
}

async function queryTracks(input: CloudMusicListInput, visibleOnly: boolean): Promise<CloudMusicListResult> {
  const db = getAppDb();
  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const limit = Math.min(200, Math.max(1, Math.trunc(input.limit ?? 30)));
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (visibleOnly) {
    where.push("status IN ('active','disabled')");
    where.push("deleted_at IS NULL");
  } else {
    const statuses = input.status === "all" || input.status === undefined
      ? []
      : Array.isArray(input.status) ? input.status : [input.status];
    if (statuses.length > 0) {
      where.push(`status IN (${statuses.map(() => "?").join(",")})`);
      params.push(...statuses);
    }
    if (!input.includeDeleted) where.push("deleted_at IS NULL");
  }
  if (input.uploadState) {
    where.push("upload_state = ?");
    params.push(input.uploadState);
  }
  const keyword = String(input.keyword ?? "").trim();
  if (keyword) {
    where.push("(title LIKE ? OR artist LIKE ? OR album LIKE ?)");
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = Number(((await db.queryOne(`SELECT COUNT(*) AS total FROM cloud_music_tracks ${whereSql}`, [...params])) as { total: number }).total) || 0;
  const rows = (await db.query(`SELECT * FROM cloud_music_tracks ${whereSql}
     ORDER BY updated_at DESC, uuid ASC LIMIT ? OFFSET ?`, [...params, limit, offset])) as CloudMusicTrackRow[];
  return {
    items: await Promise.all(rows.map(async (row) => (await mapTrack(db, row, Boolean(input.includeDeleted))))),
    total,
    offset,
    limit,
  };
}

export async function listCloudMusicTracks(input: CloudMusicListInput): Promise<CloudMusicListResult> {
  return (await queryTracks(input, false));
}

export async function searchVisibleCloudMusic(input: CloudMusicSearchInput): Promise<CloudMusicListResult> {
  return (await queryTracks(input, true));
}

export async function readVisibleCloudMusicSummary(userId?: string): Promise<CloudMusicPublicSummary> {
  const db = getAppDb();
  const row = (await db.queryOne(`SELECT COUNT(*) AS total, MAX(updated_at) AS latest_updated_at
     FROM cloud_music_tracks
     WHERE status IN ('active', 'disabled') AND deleted_at IS NULL`, [])) as { total: number; latest_updated_at: number | null };

  let myContributions = 0;
  if (userId) {
    const userRow = (await db.queryOne(`SELECT COUNT(DISTINCT t.uuid) AS count
       FROM cloud_music_tracks t
       JOIN cloud_music_assets a ON a.track_uuid = t.uuid
       JOIN file_records f ON f.id = a.file_record_id
       WHERE t.status IN ('active', 'disabled')
         AND t.deleted_at IS NULL
         AND a.kind = 'audio'
         AND f.owner_user_id = ?`, [userId])) as { count: number } | undefined;
    myContributions = Number(userRow?.count) || 0;
  }

  return {
    total: Number(row.total) || 0,
    latestUpdatedAt: row.latest_updated_at === null ? null : Number(row.latest_updated_at),
    myContributions,
  };
}

export async function readUserSubmissions(userId: string, offset = 0, limit = 30): Promise<CloudMusicListResult> {
  const db = getAppDb();
  const safeOffset = Math.max(0, Math.trunc(offset));
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));

  const countRow = (await db.queryOne(`SELECT COUNT(DISTINCT t.uuid) AS total
     FROM cloud_music_tracks t
     JOIN cloud_music_assets a ON a.track_uuid = t.uuid
     JOIN file_records f ON f.id = a.file_record_id
     WHERE f.owner_user_id = ?`, [userId])) as { total: number } | undefined;

  const total = Number(countRow?.total) || 0;

  const rows = (await db.query(`SELECT DISTINCT t.*
     FROM cloud_music_tracks t
     JOIN cloud_music_assets a ON a.track_uuid = t.uuid
     JOIN file_records f ON f.id = a.file_record_id
     WHERE f.owner_user_id = ?
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`, [userId, safeLimit, safeOffset])) as CloudMusicTrackRow[];

  return {
    items: await Promise.all(rows.map(async (row) => (await mapTrack(db, row, true)))),
    total,
    offset: safeOffset,
    limit: safeLimit,
  };
}

export async function updateCloudMusicDraft(uuid: string, input: CloudMusicDraftUpdateInput): Promise<CloudMusicTrack | null> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => {
    (await updateDraftWithDb(db, uuid, input, Date.now()));
    return (await readTrackWithDb(db, uuid));
  }));
}

export async function transitionCloudMusicStatus(input: CloudMusicStatusTransitionInput): Promise<CloudMusicTrack | null> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => {
    const now = Date.now();
    const existing = (await db.queryOne(`SELECT upload_state FROM cloud_music_tracks WHERE uuid = ? AND deleted_at IS NULL`, [input.uuid])) as { upload_state: CloudMusicUploadState } | undefined;
    if (!existing) return null;
    if (input.status === "active" || input.status === "disabled") {
      const readyAudio = (await db.queryOne(`SELECT 1 AS ready
         FROM cloud_music_assets a
         JOIN file_records f ON f.id = a.file_record_id
         WHERE a.track_uuid = ?
           AND a.kind = 'audio'
           AND a.state = 'uploaded'
           AND a.is_current = 1
           AND a.deleted_at IS NULL
           AND f.status = 'uploaded'
           AND f.deleted_at IS NULL
         LIMIT 1`, [input.uuid])) as { ready: number } | undefined;
      if (existing.upload_state !== "ready" || !readyAudio) {
        throw new Error("网盘音乐尚未准备完成，不能转为客户端可见状态");
      }
    }
    const reviewedAt = input.reviewedAt === undefined
      ? input.reviewedBy === undefined ? null : now
      : input.reviewedAt;
    (await db.execute(`UPDATE cloud_music_tracks
       SET status = ?, status_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE uuid = ? AND deleted_at IS NULL`, [input.status, input.statusReason ?? "", input.reviewedBy ?? "", reviewedAt, now, input.uuid]));
    return (await readTrackWithDb(db, input.uuid));
  }));
}

export async function listStaleTempTracks(olderThan: number, limit: number): Promise<CloudMusicTrack[]> {
  const db = getAppDb();
  const rows = (await db.query(`SELECT * FROM cloud_music_tracks
     WHERE status = 'temp' AND deleted_at IS NULL AND created_at < ?
     ORDER BY created_at ASC LIMIT ?`, [olderThan, Math.min(500, Math.max(1, Math.trunc(limit)))])) as CloudMusicTrackRow[];
  return Promise.all(rows.map(async (row) => (await mapTrack(db, row))));
}

export async function markCloudMusicDeleted(uuid: string, deletedAt: number): Promise<CloudMusicTrack | null> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => {
    const existing = (await readTrackWithDb(db, uuid, true));
    if (!existing) return null;
    (await db.execute(`UPDATE cloud_music_tracks
       SET status = 'deleted', deleted_at = ?, updated_at = ?
       WHERE uuid = ?`, [deletedAt, deletedAt, uuid]));
    (await db.execute(`UPDATE cloud_music_assets
       SET state = 'deleted', is_current = 0, deleted_at = ?, updated_at = ?
       WHERE track_uuid = ?`, [deletedAt, deletedAt, uuid]));
    (await db.execute(`UPDATE file_records
       SET status = 'deleted', referenced_by = '[]', deleted_at = ?
       WHERE id IN (SELECT file_record_id FROM cloud_music_assets WHERE track_uuid = ?)`, [deletedAt, uuid]));
    return (await readTrackWithDb(db, uuid, true));
  }));
}

export async function readCloudMusicByFileRecordId(fileRecordId: string): Promise<CloudMusicTrack | null> {
  const db = getAppDb();
  const row = (await db.queryOne(`SELECT t.*
     FROM cloud_music_tracks t
     JOIN cloud_music_assets a ON a.track_uuid = t.uuid
     WHERE a.file_record_id = ?
     LIMIT 1`, [fileRecordId])) as CloudMusicTrackRow | undefined;
  return row ? (await mapTrack(db, row, true)) : null;
}
