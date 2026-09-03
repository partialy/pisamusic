import { randomUUID } from "node:crypto";
import { getAppDb } from "./appDb";

export type AnnouncementReadPlatform = "android" | "desktop";

export type AnnouncementReadInput = {
  announcementId: string;
  readerKey: string;
  userId: string | null;
  userSnapshot: Record<string, unknown> | null;
  platform: AnnouncementReadPlatform;
  deviceId: string;
  deviceSnapshot: Record<string, unknown>;
  clientIp: string;
  userAgent: string;
  readAt: number;
};

export type AnnouncementReadReceipt = {
  id: string;
  announcementId: string;
  readAt: number;
  createdAt: number;
};

export type AnnouncementReadListItem = {
  id: string;
  announcementId: string;
  readAt: number;
  createdAt: number;
  user: Record<string, unknown> | null;
  device: Record<string, unknown>;
};

export type AnnouncementReadPage = {
  items: AnnouncementReadListItem[];
  total: number;
  offset: number;
  limit: number;
};

const MAX_PAGE_SIZE = 100;

type AnnouncementReadRow = {
  id: string;
  announcement_id: string;
  user_id: string | null;
  user_snapshot_json: string;
  platform: AnnouncementReadPlatform;
  device_id: string;
  device_snapshot_json: string;
  created_at: number;
  read_at: number;
};

function parseSnapshot(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 使用空快照兜底，避免单条损坏记录阻断整个后台列表。
  }
  return {};
}

function normalizePageValue(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.trunc(value as number)));
}

export function announcementExists(announcementId: string): boolean {
  const row = getAppDb().prepare("SELECT 1 AS found FROM announcements WHERE id = ?").get(announcementId) as
    | { found: number }
    | undefined;
  return Boolean(row);
}

export function upsertAnnouncementRead(input: AnnouncementReadInput): AnnouncementReadReceipt {
  const db = getAppDb();
  const now = input.readAt;
  db.prepare(
    `INSERT INTO announcement_reads (
      id, announcement_id, reader_key, user_id, user_snapshot_json,
      platform, device_id, device_snapshot_json, client_ip, user_agent, created_at, read_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(announcement_id, reader_key) DO UPDATE SET
      user_id = excluded.user_id,
      user_snapshot_json = excluded.user_snapshot_json,
      platform = excluded.platform,
      device_id = excluded.device_id,
      device_snapshot_json = excluded.device_snapshot_json,
      client_ip = excluded.client_ip,
      user_agent = excluded.user_agent,
      read_at = excluded.read_at`,
  ).run(
    randomUUID(),
    input.announcementId,
    input.readerKey,
    input.userId,
    JSON.stringify(input.userSnapshot ?? {}),
    input.platform,
    input.deviceId,
    JSON.stringify(input.deviceSnapshot),
    input.clientIp,
    input.userAgent,
    now,
    now,
  );

  const row = db
    .prepare(
      `SELECT id, announcement_id, created_at, read_at
       FROM announcement_reads
       WHERE announcement_id = ? AND reader_key = ?`,
    )
    .get(input.announcementId, input.readerKey) as
    | { id: string; announcement_id: string; created_at: number; read_at: number }
    | undefined;
  if (!row) throw new Error("公告已读回执写入后读取失败");
  return {
    id: row.id,
    announcementId: row.announcement_id,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export function readAnnouncementReads(
  announcementId: string,
  offsetValue = 0,
  limitValue = 20,
): AnnouncementReadPage {
  const offset = normalizePageValue(offsetValue, 0, Number.MAX_SAFE_INTEGER);
  const limit = normalizePageValue(limitValue, 20, MAX_PAGE_SIZE) || 1;
  const db = getAppDb();
  const totalRow = db
    .prepare("SELECT COUNT(*) AS total FROM announcement_reads WHERE announcement_id = ?")
    .get(announcementId) as { total: number };
  const rows = db
    .prepare(
      `SELECT id, announcement_id, user_id, user_snapshot_json, platform, device_id,
              device_snapshot_json, created_at, read_at
       FROM announcement_reads
       WHERE announcement_id = ?
       ORDER BY read_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(announcementId, limit, offset) as AnnouncementReadRow[];

  const items = rows.map((row) => {
    const userSnapshot = parseSnapshot(row.user_snapshot_json);
    const deviceSnapshot = parseSnapshot(row.device_snapshot_json);
    const user = row.user_id || Object.keys(userSnapshot).length > 0 ? userSnapshot : null;
    return {
      id: row.id,
      announcementId: row.announcement_id,
      readAt: row.read_at,
      createdAt: row.created_at,
      user,
      device: {
        id: row.device_id,
        platform: row.platform,
        ...deviceSnapshot,
      },
    };
  });

  return {
    items,
    total: totalRow.total,
    offset,
    limit,
  };
}
