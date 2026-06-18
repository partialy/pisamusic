import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { getAppDb } from "./appDb";
import type { PublicUser } from "./userStore";

export const SHARE_TYPES = ["song", "playlist"] as const;
export type ShareType = (typeof SHARE_TYPES)[number];

export type ShareCreateInput = {
  type: ShareType;
  rawJson: unknown;
};

export type ShareSharer = {
  userId: string;
  user: PublicUser;
};

export type ShareRecord = {
  uuid: string;
  type: ShareType;
  source: string;
  sourceId: string;
  title: string;
  description: string;
  coverUrl: string;
  rawJson: Record<string, unknown>;
  sharer: SharePublicSharer;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  valid: boolean;
};

export type AdminShareFilter = {
  type?: ShareType;
  sharer?: string;
  valid?: boolean;
  offset?: unknown;
  limit?: unknown;
};

export type AdminShareListItem = {
  uuid: string;
  type: ShareType;
  source: string;
  sourceId: string;
  title: string;
  description: string;
  coverUrl: string;
  sharer: SharePublicSharer;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  valid: boolean;
  invalidatedAt: number | null;
};

export type AdminShareListResult = {
  items: AdminShareListItem[];
  total: number;
  offset: number;
  limit: number;
};

export type SharePublicSharer = {
  id: string;
  username: string;
  avatarUrl: string;
};

type NormalizedSharePayload = {
  source: string;
  sourceId: string;
  subjectKey: string;
  title: string;
  description: string;
  coverUrl: string;
  rawJson: Record<string, unknown>;
  rawJsonText: string;
};

type ShareRow = {
  uuid: string;
  type: ShareType;
  source: string;
  source_id: string;
  subject_key: string;
  title: string;
  description: string;
  cover_url: string;
  raw_json: string;
  sharer_snapshot_json: string;
  created_at: number;
  updated_at: number;
  access_count: number;
  valid: number;
};

type AdminShareRow = ShareRow & {
  sharer_user_id: string;
  invalidated_at: number | null;
};

const SHARE_TYPE_SET = new Set<string>(SHARE_TYPES);
const MAX_RAW_JSON_BYTES = 64 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_KEYS = new Set([
  "playUrl",
  "play_url",
  "filePath",
  "file_path",
  "localPath",
  "local_path",
  "path",
  "lyric",
  "lyrics",
  "lrc",
  "krc",
  "yrc",
  "rawLyric",
  "raw_lyric",
  "coverBase64",
  "cover_base64",
  "embeddedCover",
  "embedded_cover",
]);

export class ShareValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareValidationError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new ShareValidationError(`${label}不能为空`);
  const text = value.trim();
  if (!text) throw new ShareValidationError(`${label}不能为空`);
  if (text.length > 512) throw new ShareValidationError(`${label}过长`);
  return text;
}

function optionalString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 2048);
}

function normalizeShareCoverUrl(source: string, coverUrl: string): string {
  const cover = optionalString(coverUrl);
  if (!cover) return "";
  if (source.trim().toLowerCase() === "kg") return cover.replace(/\{size\}/g, "240");
  return cover;
}

function assertNoForbiddenFields(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFields(item, [...path, String(index)]));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new ShareValidationError(`分享数据不能包含 ${[...path, key].join(".")} 字段`);
    }
    if (typeof child === "string" && child.length > MAX_RAW_JSON_BYTES) {
      throw new ShareValidationError("分享数据字段过长");
    }
    assertNoForbiddenFields(child, [...path, key]);
  }
}

function parseRawJson(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return isPlainObject(value) ? value : {};
  } catch {
    return {};
  }
}

function parseSharer(raw: string): SharePublicSharer {
  try {
    const value = JSON.parse(raw) as unknown;
    if (isPlainObject(value)) {
      return {
        id: optionalString(value.id),
        username: optionalString(value.username),
        avatarUrl: optionalString(value.avatarUrl),
      };
    }
  } catch {
    // fallback below
  }
  return { id: "", username: "", avatarUrl: "" };
}

function buildSharerSnapshot(user: PublicUser): SharePublicSharer {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl || user.avatar || "",
  };
}

function mapRow(row: ShareRow): ShareRecord {
  return {
    uuid: row.uuid,
    type: row.type,
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    description: row.description,
    coverUrl: normalizeShareCoverUrl(row.source, row.cover_url),
    rawJson: parseRawJson(row.raw_json),
    sharer: parseSharer(row.sharer_snapshot_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessCount: Number(row.access_count) || 0,
    valid: row.valid === 1,
  };
}

function mapAdminRow(row: AdminShareRow): AdminShareListItem {
  const sharer = parseSharer(row.sharer_snapshot_json);
  return {
    uuid: row.uuid,
    type: row.type,
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    sharer: {
      ...sharer,
      id: sharer.id || row.sharer_user_id,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessCount: Number(row.access_count) || 0,
    valid: row.valid === 1,
    invalidatedAt: row.invalidated_at ?? null,
  };
}

function normalizePagination(offset: unknown, limit: unknown): { offset: number; limit: number } {
  return {
    offset: Math.max(0, Math.trunc(Number(offset) || 0)),
    limit: Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20))),
  };
}

function buildAdminWhere(filter: AdminShareFilter): { sql: string; params: Array<string | number> } {
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (filter.type) {
    clauses.push("s.type = ?");
    params.push(filter.type);
  }
  if (typeof filter.valid === "boolean") {
    clauses.push("s.valid = ?");
    params.push(filter.valid ? 1 : 0);
  }
  const sharer = typeof filter.sharer === "string" ? filter.sharer.trim() : "";
  if (sharer) {
    const term = `%${sharer}%`;
    clauses.push(
      "(s.sharer_user_id LIKE ? OR s.sharer_snapshot_json LIKE ? OR COALESCE(u.username, '') LIKE ? OR COALESCE(u.email, '') LIKE ?)",
    );
    params.push(term, term, term, term);
  }
  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

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

export function normalizeSharePayload(type: ShareType, rawJson: unknown): NormalizedSharePayload {
  if (!SHARE_TYPE_SET.has(type)) throw new ShareValidationError("无效的分享类型");
  if (!isPlainObject(rawJson)) throw new ShareValidationError("分享数据格式无效");
  assertNoForbiddenFields(rawJson);

  const source = requiredString(rawJson.source, "来源");
  const sourceId = requiredString(rawJson.id, "ID");
  const title = requiredString(rawJson.name, type === "song" ? "歌曲名" : "歌单名");
  const description =
    type === "song"
      ? requiredString(rawJson.singer, "歌手")
      : optionalString(rawJson.desc);
  const coverUrl = optionalString(rawJson.cover);
  const rawJsonText = JSON.stringify(rawJson);
  if (Buffer.byteLength(rawJsonText, "utf8") > MAX_RAW_JSON_BYTES) {
    throw new ShareValidationError("分享数据不能超过64KB");
  }

  return {
    source,
    sourceId,
    subjectKey: `${source}:${sourceId}`,
    title,
    description,
    coverUrl,
    rawJson,
    rawJsonText,
  };
}

export function createShareRecord(input: ShareCreateInput, sharer: ShareSharer): ShareRecord {
  const normalized = normalizeSharePayload(input.type, input.rawJson);
  const now = Date.now();
  const sharerSnapshot = buildSharerSnapshot(sharer.user);
  const db = getAppDb();
  return runInTransaction(db, () => {
    const existing = db
      .prepare(
        `SELECT *
         FROM share_records
         WHERE sharer_user_id = ?
           AND type = ?
           AND subject_key = ?
           AND valid = 1
         LIMIT 1`,
      )
      .get(sharer.userId, input.type, normalized.subjectKey) as ShareRow | undefined;
    if (existing) {
      const sharerSnapshotJson = JSON.stringify(sharerSnapshot);
      db.prepare(
        `UPDATE share_records
         SET source = ?,
             source_id = ?,
             title = ?,
             description = ?,
             cover_url = ?,
             raw_json = ?,
             sharer_snapshot_json = ?,
             updated_at = ?
         WHERE uuid = ?`,
      ).run(
        normalized.source,
        normalized.sourceId,
        normalized.title,
        normalized.description,
        normalized.coverUrl,
        normalized.rawJsonText,
        sharerSnapshotJson,
        now,
        existing.uuid,
      );
      return mapRow({
        ...existing,
        source: normalized.source,
        source_id: normalized.sourceId,
        title: normalized.title,
        description: normalized.description,
        cover_url: normalized.coverUrl,
        raw_json: normalized.rawJsonText,
        sharer_snapshot_json: sharerSnapshotJson,
        updated_at: now,
      });
    }

    const uuid = randomUUID();
  db.prepare(
    `INSERT INTO share_records (
      uuid, type, source, source_id, subject_key, title, description, cover_url, raw_json,
      sharer_user_id, sharer_snapshot_json, created_at, updated_at, access_count, valid, invalidated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, NULL)`,
  ).run(
    uuid,
    input.type,
    normalized.source,
    normalized.sourceId,
    normalized.subjectKey,
    normalized.title,
    normalized.description,
    normalized.coverUrl,
    normalized.rawJsonText,
    sharer.userId,
    JSON.stringify(sharerSnapshot),
    now,
    now,
  );
  const created = readPublicShare(uuid);
  if (!created) throw new Error("分享记录创建失败");
  return created;
  });
}

export function readPublicShare(uuid: string): ShareRecord | null {
  if (!UUID_PATTERN.test(uuid)) return null;
  const row = getAppDb()
    .prepare(
      `SELECT *
       FROM share_records
       WHERE uuid = ? AND valid = 1
       LIMIT 1`,
    )
    .get(uuid) as ShareRow | undefined;
  return row ? mapRow(row) : null;
}

export function readPublicShareAndIncrement(uuid: string): ShareRecord | null {
  if (!UUID_PATTERN.test(uuid)) return null;
  return runInTransaction(getAppDb(), () => {
    const row = getAppDb()
      .prepare(
        `SELECT *
         FROM share_records
         WHERE uuid = ? AND valid = 1
         LIMIT 1`,
      )
      .get(uuid) as ShareRow | undefined;
    if (!row) return null;
    const nextAccessCount = (Number(row.access_count) || 0) + 1;
    getAppDb()
      .prepare("UPDATE share_records SET access_count = ?, updated_at = ? WHERE uuid = ?")
      .run(nextAccessCount, Date.now(), uuid);
    return mapRow({ ...row, access_count: nextAccessCount });
  });
}

export function listAdminShares(filter: AdminShareFilter): AdminShareListResult {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(filter.offset, filter.limit);
  const where = buildAdminWhere(filter);
  const fromSql = `FROM share_records s LEFT JOIN users u ON u.id = s.sharer_user_id ${where.sql}`;
  const totalRow = db.prepare(`SELECT COUNT(*) AS total ${fromSql}`).get(...where.params) as { total: number };
  const rows = db
    .prepare(
      `SELECT s.*
       ${fromSql}
       ORDER BY s.updated_at DESC, s.created_at DESC, s.uuid ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...where.params, limit, offset) as AdminShareRow[];
  return {
    items: rows.map(mapAdminRow),
    total: Number(totalRow.total) || 0,
    offset,
    limit,
  };
}

export function readAdminShareRecord(uuid: string): AdminShareListItem | null {
  if (!UUID_PATTERN.test(uuid)) return null;
  const row = getAppDb()
    .prepare("SELECT * FROM share_records WHERE uuid = ? LIMIT 1")
    .get(uuid) as AdminShareRow | undefined;
  return row ? mapAdminRow(row) : null;
}

export function invalidateShareRecord(uuid: string): AdminShareListItem | null {
  if (!UUID_PATTERN.test(uuid)) return null;
  const existing = readAdminShareRecord(uuid);
  if (!existing) return null;
  if (!existing.valid) return existing;
  const now = Date.now();
  getAppDb()
    .prepare("UPDATE share_records SET valid = 0, invalidated_at = ?, updated_at = ? WHERE uuid = ?")
    .run(now, now, uuid);
  return readAdminShareRecord(uuid);
}
