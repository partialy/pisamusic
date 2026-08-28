import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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

function runInTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
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

function readAssets(db: DatabaseSync, trackUuid: string, includeDeleted: boolean): CloudMusicAsset[] {
  const where = includeDeleted ? "track_uuid = ?" : "track_uuid = ? AND deleted_at IS NULL";
  const rows = db.prepare(
    `SELECT * FROM cloud_music_assets WHERE ${where} ORDER BY created_at ASC, id ASC`,
  ).all(trackUuid) as CloudMusicAssetRow[];
  return rows.map(mapAsset);
}

function mapTrack(db: DatabaseSync, row: CloudMusicTrackRow, includeDeleted = false): CloudMusicTrack {
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
    assets: readAssets(db, row.uuid, includeDeleted),
  };
}

function readTrackWithDb(db: DatabaseSync, uuid: string, includeDeleted = false): CloudMusicTrack | null {
  const deletedClause = includeDeleted ? "" : "AND deleted_at IS NULL";
  const row = db.prepare(
    `SELECT * FROM cloud_music_tracks WHERE uuid = ? ${deletedClause}`,
  ).get(uuid) as CloudMusicTrackRow | undefined;
  return row ? mapTrack(db, row, includeDeleted) : null;
}

function reserveAssetWithDb(db: DatabaseSync, input: CloudMusicAssetReserveInput, now: number): CloudMusicReservedAsset {
  if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0) throw new Error("网盘音乐资产声明大小不正确");
  if (!input.mimeType.trim()) throw new Error("网盘音乐资产 MIME 不能为空");
  const track = db.prepare(
    "SELECT uuid FROM cloud_music_tracks WHERE uuid = ? AND deleted_at IS NULL",
  ).get(input.trackUuid) as { uuid: string } | undefined;
  if (!track) throw new Error("网盘音乐曲目不存在");

  const ownerType = input.ownerType ?? "system";
  const ownerUserId = input.ownerUserId ?? null;
  const ownerSnapshotJson = JSON.stringify(input.ownerSnapshot ?? { displayName: ownerType });

  db.prepare(
    `INSERT INTO file_records (
      id, usage_type, owner_type, owner_user_id, owner_snapshot_json,
      platform, version, asset_type, provider, bucket, object_key, hash,
      file_name, mime_type, file_size, download_url, status, referenced_by, created_at, deleted_at
    ) VALUES (?, 'cloud-music', ?, ?, ?, 'server', '', ?, 'qiniu', ?, ?, '', ?, ?, ?, '', 'pending', ?, ?, NULL)`,
  ).run(
    input.fileRecordId,
    ownerType,
    ownerUserId,
    ownerSnapshotJson,
    input.kind,
    input.bucket,
    input.objectKey,
    input.fileName,
    input.mimeType,
    input.fileSize,
    JSON.stringify([{ type: "cloud-music", id: input.trackUuid }]),
    now,
  );
  db.prepare(
    `INSERT INTO cloud_music_assets (
      id, track_uuid, file_record_id, kind, state, is_current, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, NULL)`,
  ).run(input.assetId, input.trackUuid, input.fileRecordId, input.kind, now, now);

  const row = db.prepare(
    `SELECT a.*, f.bucket, f.object_key, f.file_name, f.mime_type, f.file_size
     FROM cloud_music_assets a
     JOIN file_records f ON f.id = a.file_record_id
     WHERE a.id = ?`,
  ).get(input.assetId) as ReservedAssetRow | undefined;
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

function updateDraftWithDb(db: DatabaseSync, uuid: string, input: CloudMusicDraftUpdateInput, now: number): void {
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
  db.prepare(
    `UPDATE cloud_music_tracks SET ${assignments.join(", ")} WHERE uuid = ? AND deleted_at IS NULL`,
  ).run(...values);
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

export function createCloudMusicUploadSession(input: CloudMusicSessionCreateInput): CloudMusicTrack {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const now = Date.now();
    const ownerType = input.owner?.type ?? "system";
    const ownerUserId = input.owner?.userId ?? null;
    const ownerSnapshot = input.owner?.snapshot ?? { displayName: ownerType };

    db.prepare(
      `INSERT INTO cloud_music_tracks (
        uuid, status, upload_state, status_reason, title, artist, created_at, updated_at, deleted_at
      ) VALUES (?, 'temp', 'reserved', '', ?, '未知歌手', ?, ?, NULL)`,
    ).run(input.uuid, path.basename(input.audio.fileName), now, now);

    reserveAssetWithDb(db, {
      ...input.audio,
      trackUuid: input.uuid,
      kind: "audio",
      ownerType,
      ownerUserId,
      ownerSnapshot,
    }, now);

    if (input.cover) {
      reserveAssetWithDb(db, {
        ...input.cover,
        trackUuid: input.uuid,
        kind: "cover-uploaded",
        ownerType,
        ownerUserId,
        ownerSnapshot,
      }, now);
    }
    if (input.lyrics) {
      reserveAssetWithDb(db, {
        ...input.lyrics,
        trackUuid: input.uuid,
        kind: "lyrics",
        ownerType,
        ownerUserId,
        ownerSnapshot,
      }, now);
    }

    const track = readTrackWithDb(db, input.uuid);
    if (!track) throw new Error("网盘音乐上传会话创建失败");
    return track;
  });
}

export function readTrackOwnerInfo(uuid: string): { ownerType: string; ownerUserId: string | null; ownerSnapshot: Record<string, unknown> } | null {
  const db = getAppDb();
  const row = db.prepare(
    `SELECT f.owner_type, f.owner_user_id, f.owner_snapshot_json
     FROM cloud_music_assets a
     JOIN file_records f ON f.id = a.file_record_id
     WHERE a.track_uuid = ? AND a.kind = 'audio' AND a.deleted_at IS NULL
     LIMIT 1`,
  ).get(uuid) as { owner_type: string; owner_user_id: string | null; owner_snapshot_json: string } | undefined;
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

export function reserveCloudMusicAsset(input: CloudMusicAssetReserveInput): CloudMusicReservedAsset {
  const db = getAppDb();
  return runInTransaction(db, () => reserveAssetWithDb(db, input, Date.now()));
}

export function confirmCloudMusicAsset(input: CloudMusicAssetConfirmInput): CloudMusicTrack {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const now = Date.now();
    const asset = db.prepare(
      `SELECT * FROM cloud_music_assets WHERE file_record_id = ? AND deleted_at IS NULL`,
    ).get(input.fileRecordId) as CloudMusicAssetRow | undefined;
    if (!asset) throw new Error("网盘音乐资产不存在");
    const trackRow = db.prepare(
      `SELECT upload_state FROM cloud_music_tracks WHERE uuid = ? AND deleted_at IS NULL`,
    ).get(asset.track_uuid) as { upload_state: CloudMusicUploadState } | undefined;
    if (!trackRow) throw new Error("网盘音乐曲目不存在");
    const nextUploadState = asset.kind === "audio"
      ? input.uploadState ?? "uploaded"
      : trackRow.upload_state;
    if (asset.kind === "audio") assertUploadTransition(trackRow.upload_state, nextUploadState as Exclude<CloudMusicUploadState, "reserved">);

    db.prepare(
      `UPDATE file_records
       SET hash = ?, mime_type = ?, file_size = ?, status = 'uploaded', deleted_at = NULL
       WHERE id = ? AND status <> 'deleted'`,
    ).run(input.hash, input.mimeType, Math.max(0, Math.trunc(input.fileSize)), input.fileRecordId);
    db.prepare(
      `UPDATE cloud_music_assets
       SET state = 'superseded', is_current = 0, updated_at = ?
       WHERE track_uuid = ? AND kind = ? AND id <> ? AND is_current = 1 AND deleted_at IS NULL`,
    ).run(now, asset.track_uuid, asset.kind, asset.id);
    db.prepare(
      `UPDATE cloud_music_assets
       SET state = 'uploaded', is_current = 1, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    ).run(now, asset.id);
    if (asset.kind === "audio") {
      if (input.parsed) updateDraftWithDb(db, asset.track_uuid, input.parsed, now);
      db.prepare(
        `UPDATE cloud_music_tracks
         SET upload_state = ?, status_reason = ?, updated_at = ?
         WHERE uuid = ? AND deleted_at IS NULL`,
      ).run(nextUploadState, input.statusReason ?? "", now, asset.track_uuid);
    }

    const track = readTrackWithDb(db, asset.track_uuid);
    if (!track) throw new Error("网盘音乐资产确认失败");
    return track;
  });
}

export function readCloudMusicTrack(uuid: string, includeDeleted = false): CloudMusicTrack | null {
  return readTrackWithDb(getAppDb(), uuid, includeDeleted);
}

export function readCloudMusicReservedAsset(fileRecordId: string): CloudMusicReservedAsset | null {
  const row = getAppDb().prepare(
    `SELECT a.*, f.bucket, f.object_key, f.file_name, f.mime_type, f.file_size
     FROM cloud_music_assets a
     JOIN cloud_music_tracks t ON t.uuid = a.track_uuid
     JOIN file_records f ON f.id = a.file_record_id
     WHERE a.file_record_id = ?
       AND a.state = 'pending'
       AND a.deleted_at IS NULL
       AND t.status = 'temp'
       AND t.deleted_at IS NULL
       AND f.status = 'pending'
       AND f.deleted_at IS NULL`,
  ).get(fileRecordId) as ReservedAssetRow | undefined;
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

function queryTracks(input: CloudMusicListInput, visibleOnly: boolean): CloudMusicListResult {
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
  const total = Number((db.prepare(
    `SELECT COUNT(*) AS total FROM cloud_music_tracks ${whereSql}`,
  ).get(...params) as { total: number }).total) || 0;
  const rows = db.prepare(
    `SELECT * FROM cloud_music_tracks ${whereSql}
     ORDER BY updated_at DESC, uuid ASC LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset) as CloudMusicTrackRow[];
  return {
    items: rows.map((row) => mapTrack(db, row, Boolean(input.includeDeleted))),
    total,
    offset,
    limit,
  };
}

export function listCloudMusicTracks(input: CloudMusicListInput): CloudMusicListResult {
  return queryTracks(input, false);
}

export function searchVisibleCloudMusic(input: CloudMusicSearchInput): CloudMusicListResult {
  return queryTracks(input, true);
}

export function readVisibleCloudMusicSummary(userId?: string): CloudMusicPublicSummary {
  const db = getAppDb();
  const row = db.prepare(
    `SELECT COUNT(*) AS total, MAX(updated_at) AS latest_updated_at
     FROM cloud_music_tracks
     WHERE status IN ('active', 'disabled') AND deleted_at IS NULL`,
  ).get() as { total: number; latest_updated_at: number | null };

  let myContributions = 0;
  if (userId) {
    const userRow = db.prepare(
      `SELECT COUNT(DISTINCT t.uuid) AS count
       FROM cloud_music_tracks t
       JOIN cloud_music_assets a ON a.track_uuid = t.uuid
       JOIN file_records f ON f.id = a.file_record_id
       WHERE t.status IN ('active', 'disabled')
         AND t.deleted_at IS NULL
         AND a.kind = 'audio'
         AND f.owner_user_id = ?`,
    ).get(userId) as { count: number } | undefined;
    myContributions = Number(userRow?.count) || 0;
  }

  return {
    total: Number(row.total) || 0,
    latestUpdatedAt: row.latest_updated_at === null ? null : Number(row.latest_updated_at),
    myContributions,
  };
}

export function updateCloudMusicDraft(uuid: string, input: CloudMusicDraftUpdateInput): CloudMusicTrack | null {
  const db = getAppDb();
  return runInTransaction(db, () => {
    updateDraftWithDb(db, uuid, input, Date.now());
    return readTrackWithDb(db, uuid);
  });
}

export function transitionCloudMusicStatus(input: CloudMusicStatusTransitionInput): CloudMusicTrack | null {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const now = Date.now();
    const existing = db.prepare(
      `SELECT upload_state FROM cloud_music_tracks WHERE uuid = ? AND deleted_at IS NULL`,
    ).get(input.uuid) as { upload_state: CloudMusicUploadState } | undefined;
    if (!existing) return null;
    if (input.status === "active" || input.status === "disabled") {
      const readyAudio = db.prepare(
        `SELECT 1 AS ready
         FROM cloud_music_assets a
         JOIN file_records f ON f.id = a.file_record_id
         WHERE a.track_uuid = ?
           AND a.kind = 'audio'
           AND a.state = 'uploaded'
           AND a.is_current = 1
           AND a.deleted_at IS NULL
           AND f.status = 'uploaded'
           AND f.deleted_at IS NULL
         LIMIT 1`,
      ).get(input.uuid) as { ready: number } | undefined;
      if (existing.upload_state !== "ready" || !readyAudio) {
        throw new Error("网盘音乐尚未准备完成，不能转为客户端可见状态");
      }
    }
    const reviewedAt = input.reviewedAt === undefined
      ? input.reviewedBy === undefined ? null : now
      : input.reviewedAt;
    db.prepare(
      `UPDATE cloud_music_tracks
       SET status = ?, status_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE uuid = ? AND deleted_at IS NULL`,
    ).run(input.status, input.statusReason ?? "", input.reviewedBy ?? "", reviewedAt, now, input.uuid);
    return readTrackWithDb(db, input.uuid);
  });
}

export function listStaleTempTracks(olderThan: number, limit: number): CloudMusicTrack[] {
  const db = getAppDb();
  const rows = db.prepare(
    `SELECT * FROM cloud_music_tracks
     WHERE status = 'temp' AND deleted_at IS NULL AND created_at < ?
     ORDER BY created_at ASC LIMIT ?`,
  ).all(olderThan, Math.min(500, Math.max(1, Math.trunc(limit)))) as CloudMusicTrackRow[];
  return rows.map((row) => mapTrack(db, row));
}

export function markCloudMusicDeleted(uuid: string, deletedAt: number): CloudMusicTrack | null {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const existing = readTrackWithDb(db, uuid, true);
    if (!existing) return null;
    db.prepare(
      `UPDATE cloud_music_tracks
       SET status = 'deleted', deleted_at = ?, updated_at = ?
       WHERE uuid = ?`,
    ).run(deletedAt, deletedAt, uuid);
    db.prepare(
      `UPDATE cloud_music_assets
       SET state = 'deleted', is_current = 0, deleted_at = ?, updated_at = ?
       WHERE track_uuid = ?`,
    ).run(deletedAt, deletedAt, uuid);
    db.prepare(
      `UPDATE file_records
       SET status = 'deleted', referenced_by = '[]', deleted_at = ?
       WHERE id IN (SELECT file_record_id FROM cloud_music_assets WHERE track_uuid = ?)`,
    ).run(deletedAt, uuid);
    return readTrackWithDb(db, uuid, true);
  });
}

export function readCloudMusicByFileRecordId(fileRecordId: string): CloudMusicTrack | null {
  const db = getAppDb();
  const row = db.prepare(
    `SELECT t.*
     FROM cloud_music_tracks t
     JOIN cloud_music_assets a ON a.track_uuid = t.uuid
     WHERE a.file_record_id = ?
     LIMIT 1`,
  ).get(fileRecordId) as CloudMusicTrackRow | undefined;
  return row ? mapTrack(db, row, true) : null;
}
