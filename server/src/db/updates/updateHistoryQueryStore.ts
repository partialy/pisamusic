import type { DbTransaction } from "../core/types";
import { getAppDb } from "../appDb";
import {
  mapFileRecord,
  releaseFileFromRecord,
  type ReleaseFileInfo,
} from "../files/fileRecordStore";
import type { ReleasePlatform } from "../system/systemConfigStore";
import type { UpdateHistoryItem } from "./updateHistoryStore";

export type UpdateHistoryQueryItem = UpdateHistoryItem & {
  createdAt: number;
};

type UpdateHistoryJoinedRow = {
  id: string;
  platform?: ReleasePlatform;
  version: string;
  update_time: string;
  force_update: number;
  download_url: string;
  official_url: string;
  update_content: string;
  release_file_id: string | null;
  created_at: number;
  file_id: string | null;
  usage_type: string | null;
  owner_type: string | null;
  owner_user_id: string | null;
  owner_snapshot_json: string | null;
  file_platform: string | null;
  file_version: string | null;
  asset_type: string | null;
  provider: string | null;
  bucket: string | null;
  object_key: string | null;
  hash: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  file_download_url: string | null;
  status: string | null;
  referenced_by: string | null;
  file_created_at: number | null;
  file_deleted_at: number | null;
};

const SELECT_HISTORY_JOINED_COLUMNS = `
  h.id, h.platform, h.version, h.update_time, h.force_update, h.download_url,
  h.official_url, h.update_content, h.release_file_id, h.created_at,
  f.id AS file_id, f.usage_type, f.owner_type, f.owner_user_id, f.owner_snapshot_json,
  f.platform AS file_platform, f.version AS file_version,
  f.asset_type, f.provider, f.bucket, f.object_key, f.hash, f.file_name, f.mime_type,
  f.file_size, f.download_url AS file_download_url, f.status, f.referenced_by,
  f.created_at AS file_created_at, f.deleted_at AS file_deleted_at
`;

function mapJoinedRow(row: UpdateHistoryJoinedRow): UpdateHistoryQueryItem {
  const platform: ReleasePlatform = row.platform === "desktop" ? "desktop" : "android";
  const releaseFile: ReleaseFileInfo | null =
    row.file_id && row.provider && row.bucket && row.object_key && row.file_name && row.mime_type
      ? releaseFileFromRecord(
          mapFileRecord({
            id: row.file_id,
            usage_type: row.usage_type ?? "release-package",
            owner_type: row.owner_type ?? "system",
            owner_user_id: row.owner_user_id ?? null,
            owner_snapshot_json: row.owner_snapshot_json ?? "{}",
            platform: row.file_platform ?? platform,
            version: row.file_version ?? row.version,
            asset_type: row.asset_type ?? "installer",
            provider: row.provider,
            bucket: row.bucket,
            object_key: row.object_key,
            hash: row.hash ?? "",
            file_name: row.file_name,
            mime_type: row.mime_type,
            file_size: row.file_size ?? 0,
            download_url: row.file_download_url ?? "",
            status: row.status ?? "uploaded",
            referenced_by: row.referenced_by ?? "[]",
            created_at: row.file_created_at ?? 0,
            deleted_at: row.file_deleted_at ?? null,
          }),
        )
      : null;

  return {
    id: row.id,
    platform,
    version: row.version,
    updateTime: row.update_time,
    forceUpdate: Boolean(row.force_update),
    downloadUrl: row.download_url,
    officialUrl: row.official_url,
    updateContent: row.update_content,
    releaseFileId: row.release_file_id ?? null,
    releaseFile: releaseFile ? { ...releaseFile, historyId: row.id } : null,
    createdAt: Number(row.created_at) || 0,
  };
}

function orderByDescClause(db: DbTransaction): string {
  return db.dialect === "mysql"
    ? "ORDER BY h.created_at DESC, h.id DESC"
    : "ORDER BY h.created_at DESC, h.rowid DESC";
}

export async function queryUpdateHistoryPage(
  input: {
    platform?: ReleasePlatform;
    offset: number;
    limit: number;
  },
  db: DbTransaction = getAppDb(),
): Promise<{ items: UpdateHistoryQueryItem[]; total: number }> {
  const where: string[] = ["h.deleted_at IS NULL"];
  const params: Array<string | number> = [];

  if (input.platform) {
    where.push("h.platform = ?");
    params.push(input.platform);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const totalRow = (await db.queryOne(
    `SELECT COUNT(*) AS total FROM update_history h ${whereSql}`,
    params,
  )) as { total: number } | undefined;
  const total = Number(totalRow?.total ?? 0);

  const offset = Math.max(0, input.offset);
  const rows = (await db.query(
    `SELECT ${SELECT_HISTORY_JOINED_COLUMNS}
     FROM update_history h
     LEFT JOIN file_records f ON f.id = h.release_file_id
     ${whereSql}
     ${orderByDescClause(db)}
     LIMIT ? OFFSET ?`,
    [...params, input.limit, offset],
  )) as UpdateHistoryJoinedRow[];

  return {
    items: rows.map(mapJoinedRow),
    total,
  };
}

export async function readLatestHistoryIdsByPlatform(
  db: DbTransaction = getAppDb(),
): Promise<Partial<Record<ReleasePlatform, string>>> {
  const result: Partial<Record<ReleasePlatform, string>> = {};
  for (const platform of ["android", "desktop"] as const) {
    const row = (await db.queryOne(
      `SELECT h.id
       FROM update_history h
       WHERE h.deleted_at IS NULL AND h.platform = ?
       ${orderByDescClause(db)}
       LIMIT 1`,
      [platform],
    )) as { id: string } | undefined;
    if (row?.id) result[platform] = row.id;
  }
  return result;
}

export async function findLatestUpdateHistoryByPlatform(
  platform: ReleasePlatform,
  db: DbTransaction = getAppDb(),
): Promise<UpdateHistoryQueryItem | null> {
  const row = (await db.queryOne(
    `SELECT ${SELECT_HISTORY_JOINED_COLUMNS}
     FROM update_history h
     LEFT JOIN file_records f ON f.id = h.release_file_id
     WHERE h.deleted_at IS NULL AND h.platform = ?
     ${orderByDescClause(db)}
     LIMIT 1`,
    [platform],
  )) as UpdateHistoryJoinedRow | undefined;
  return row ? mapJoinedRow(row) : null;
}

export function normalizeReleaseVersionKey(version: string): string {
  return version.trim().replace(/^[vV]+/, "").toLowerCase();
}

export async function findUpdateHistoryByVersion(
  platform: ReleasePlatform,
  version: string,
  db: DbTransaction = getAppDb(),
): Promise<UpdateHistoryQueryItem | null> {
  const targetKey = normalizeReleaseVersionKey(version);
  if (!targetKey) return null;

  // 忽略前导 v/V 匹配同平台未删除记录，优先取最新一条
  const rows = (await db.query(
    `SELECT ${SELECT_HISTORY_JOINED_COLUMNS}
     FROM update_history h
     LEFT JOIN file_records f ON f.id = h.release_file_id
     WHERE h.deleted_at IS NULL AND h.platform = ?
     ${orderByDescClause(db)}`,
    [platform],
  )) as UpdateHistoryJoinedRow[];

  const matched = rows.find((row) => normalizeReleaseVersionKey(row.version) === targetKey);
  return matched ? mapJoinedRow(matched) : null;
}

export async function readAllActiveUpdateHistoryForExport(
  db: DbTransaction = getAppDb(),
): Promise<UpdateHistoryQueryItem[]> {
  const rows = (await db.query(
    `SELECT ${SELECT_HISTORY_JOINED_COLUMNS}
     FROM update_history h
     LEFT JOIN file_records f ON f.id = h.release_file_id
     WHERE h.deleted_at IS NULL
     ${orderByDescClause(db)}`,
    [],
  )) as UpdateHistoryJoinedRow[];
  return rows.map(mapJoinedRow);
}
