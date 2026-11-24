import { unlinkSync } from "node:fs";
import path from "node:path";
import type { PaginatedListData } from "../types/response";
import { buildPaginatedList, normalizePagination } from "../utils/pagination";
import { getAppDb } from "./appDb";

export const FEEDBACK_TYPES = ["bug", "suggestion", "account", "other"] as const;
export const FEEDBACK_STATUSES = ["pending", "processed"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export type FeedbackCreateInput = {
  id: string;
  createdAt: string;
  feedbackType: FeedbackType;
  description: string;
  contact: string | null;
  device: Record<string, unknown>;
  imagePaths: string[];
  userId?: string | null;
  deviceKind?: "android" | "desktop" | null;
  deviceId?: string | null;
};

export type ClientFeedbackIdentity = {
  userId: string | null;
  device: { kind: "android" | "desktop"; id: string } | null;
};

export type ClientFeedbackItem = {
  id: string;
  createdAt: string;
  feedbackType: FeedbackType;
  description: string;
  contact: string | null;
  status: FeedbackStatus;
  processedAt: string | null;
  imageCount: number;
  firstImageUrl: string | null;
  images: string[];
};

export type ClientFeedbackListResult = PaginatedListData<ClientFeedbackItem>;

export type AdminFeedbackFilter = {
  status?: FeedbackStatus;
  type?: FeedbackType;
  keyword?: string;
  offset?: unknown;
  limit?: unknown;
};

export type AdminFeedbackListItem = {
  id: string;
  createdAt: string;
  feedbackType: FeedbackType;
  description: string;
  contact: string | null;
  status: FeedbackStatus;
  processedAt: string | null;
  imageCount: number;
  firstImageUrl: string | null;
};

export type AdminFeedbackDetail = AdminFeedbackListItem & {
  device: Record<string, unknown>;
  images: string[];
};

export type AdminFeedbackListResult = PaginatedListData<AdminFeedbackListItem>;

type FeedbackListRow = {
  id: string;
  created_at: string;
  feedback_type: FeedbackType;
  description: string;
  contact: string | null;
  status: FeedbackStatus;
  processed_at: string | null;
  image_count: number;
  first_image_path: string | null;
};

type FeedbackDetailRow = FeedbackListRow & {
  device_json: string;
};

function normalizeImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  return `/${imagePath.replace(/^\/+/, "").replace(/\\/g, "/")}`;
}

function parseDevice(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function descriptionSummary(description: string): string {
  return description.length > 160 ? `${description.slice(0, 160)}...` : description;
}

function mapListRow(row: FeedbackListRow, summarizeDescription = true): AdminFeedbackListItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    feedbackType: row.feedback_type,
    description: summarizeDescription ? descriptionSummary(row.description) : row.description,
    contact: row.contact,
    status: row.status,
    processedAt: row.processed_at,
    imageCount: Number(row.image_count) || 0,
    firstImageUrl: normalizeImageUrl(row.first_image_path),
  };
}

function buildWhere(filter: AdminFeedbackFilter): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filter.status) {
    clauses.push("f.status = ?");
    params.push(filter.status);
  }
  if (filter.type) {
    clauses.push("f.feedback_type = ?");
    params.push(filter.type);
  }
  const keyword = filter.keyword?.trim();
  if (keyword) {
    const term = `%${keyword}%`;
    clauses.push("(f.id LIKE ? OR f.description LIKE ? OR COALESCE(f.contact, '') LIKE ?)");
    params.push(term, term, term);
  }
  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

const LIST_SELECT = `
  SELECT
    f.id,
    f.created_at,
    f.feedback_type,
    f.description,
    f.contact,
    f.status,
    f.processed_at,
    COUNT(fi.id) AS image_count,
    (
      SELECT first_image.image_path
      FROM feedback_images first_image
      WHERE first_image.feedback_id = f.id
      ORDER BY first_image.sort_order ASC, first_image.id ASC
      LIMIT 1
    ) AS first_image_path
  FROM feedback f
  LEFT JOIN feedback_images fi ON fi.feedback_id = f.id
`;

export async function insertFeedback(item: FeedbackCreateInput): Promise<void> {
  const db = getAppDb();
  const userId = item.userId ?? null;
  const deviceKind = item.deviceKind ?? null;
  const deviceId = item.deviceId ?? null;
  return (await db.transaction(async () => {
    (await db.execute(db.dialect === "mysql" ? "INSERT INTO feedback (\n        id, created_at, feedback_type, description, contact, device_json, status, processed_at, user_id, device_kind, device_id\n      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id" : `INSERT OR IGNORE INTO feedback (
        id, created_at, feedback_type, description, contact, device_json, status, processed_at, user_id, device_kind, device_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?)`, [item.id, item.createdAt, item.feedbackType, item.description, item.contact, JSON.stringify(item.device ?? {}), userId, deviceKind, deviceId]));

    await (async () => { for (const [index, imagePath] of item.imagePaths.entries()) {
      (await db.execute(`INSERT INTO feedback_images (feedback_id, image_path, sort_order)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM feedback_images WHERE feedback_id = ? AND image_path = ?
       )`, [item.id, imagePath, index, item.id, imagePath]));
    } })();

  }));
}

type ClientFeedbackRow = {
  id: string;
  created_at: string;
  feedback_type: FeedbackType;
  description: string;
  contact: string | null;
  status: FeedbackStatus;
  processed_at: string | null;
};

function buildIdentityWhere(identity: ClientFeedbackIdentity): { sql: string; params: string[] } | null {
  const parts: string[] = [];
  const params: string[] = [];
  if (identity.userId) {
    parts.push("f.user_id = ?");
    params.push(identity.userId);
  }
  if (identity.device) {
    parts.push("(f.device_kind = ? AND f.device_id = ?)");
    params.push(identity.device.kind, identity.device.id);
  }
  if (parts.length === 0) return null;
  return {
    sql: parts.length === 1 ? parts[0]! : `(${parts.join(" OR ")})`,
    params,
  };
}

function mapClientItem(row: ClientFeedbackRow, images: string[]): ClientFeedbackItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    feedbackType: row.feedback_type,
    description: row.description,
    contact: row.contact,
    status: row.status,
    processedAt: row.processed_at,
    imageCount: images.length,
    firstImageUrl: images[0] ?? null,
    images,
  };
}

export async function listClientFeedback(
  identity: ClientFeedbackIdentity,
  offsetInput: unknown,
  limitInput: unknown,
): Promise<ClientFeedbackListResult> {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(offsetInput, limitInput);
  const where = buildIdentityWhere(identity);
  if (!where) {
    return buildPaginatedList([], 0, offset, limit);
  }
  const totalRow = (await db.queryOne(
    `SELECT COUNT(*) AS total FROM feedback f WHERE ${where.sql}`,
    [...where.params],
  )) as { total: number };
  const rows = (await db.query(
    `SELECT f.id, f.created_at, f.feedback_type, f.description, f.contact, f.status, f.processed_at
     FROM feedback f
     WHERE ${where.sql}
     ORDER BY f.created_at DESC, f.id DESC
     LIMIT ? OFFSET ?`,
    [...where.params, limit, offset],
  )) as ClientFeedbackRow[];

  const imageMap = new Map<string, string[]>();
  if (rows.length > 0) {
    const placeholders = rows.map(() => "?").join(", ");
    const imageRows = (await db.query(
      `SELECT feedback_id, image_path
       FROM feedback_images
       WHERE feedback_id IN (${placeholders})
       ORDER BY sort_order ASC, id ASC`,
      rows.map((row) => row.id),
    )) as Array<{ feedback_id: string; image_path: string }>;
    for (const img of imageRows) {
      const url = normalizeImageUrl(img.image_path);
      if (!url) continue;
      const list = imageMap.get(img.feedback_id);
      if (list) list.push(url);
      else imageMap.set(img.feedback_id, [url]);
    }
  }

  return buildPaginatedList(
    rows.map((row) => mapClientItem(row, imageMap.get(row.id) ?? [])),
    totalRow.total,
    offset,
    limit,
  );
}

export async function readClientFeedbackDetail(
  identity: ClientFeedbackIdentity,
  id: string,
): Promise<ClientFeedbackItem | null> {
  const db = getAppDb();
  const where = buildIdentityWhere(identity);
  if (!where) return null;
  const row = (await db.queryOne(
    `SELECT f.id, f.created_at, f.feedback_type, f.description, f.contact, f.status, f.processed_at
     FROM feedback f
     WHERE f.id = ? AND ${where.sql}
     LIMIT 1`,
    [id, ...where.params],
  )) as ClientFeedbackRow | undefined;
  if (!row) return null;
  const imageRows = (await db.query(
    `SELECT image_path
     FROM feedback_images
     WHERE feedback_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [id],
  )) as Array<{ image_path: string }>;
  const images = imageRows
    .map((img) => normalizeImageUrl(img.image_path))
    .filter((url): url is string => Boolean(url));
  return mapClientItem(row, images);
}

export async function listAdminFeedback(filter: AdminFeedbackFilter): Promise<AdminFeedbackListResult> {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(filter.offset, filter.limit);
  const where = buildWhere(filter);
  const totalRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM feedback f ${where.sql}`, [...where.params])) as { total: number };
  const rows = (await db.query(`${LIST_SELECT}
       ${where.sql}
       GROUP BY f.id
       ORDER BY f.created_at DESC, f.id DESC
       LIMIT ? OFFSET ?`, [...where.params, limit, offset])) as FeedbackListRow[];
  return buildPaginatedList(
    rows.map((row) => mapListRow(row)),
    totalRow.total,
    offset,
    limit,
  );
}

export async function readAdminFeedbackDetail(id: string): Promise<AdminFeedbackDetail | null> {
  const db = getAppDb();
  const row = (await db.queryOne(`SELECT
        f.id,
        f.created_at,
        f.feedback_type,
        f.description,
        f.contact,
        f.status,
        f.processed_at,
        f.device_json,
        COUNT(fi.id) AS image_count,
        (
          SELECT first_image.image_path
          FROM feedback_images first_image
          WHERE first_image.feedback_id = f.id
          ORDER BY first_image.sort_order ASC, first_image.id ASC
          LIMIT 1
        ) AS first_image_path
       FROM feedback f
       LEFT JOIN feedback_images fi ON fi.feedback_id = f.id
       WHERE f.id = ?
       GROUP BY f.id
       LIMIT 1`, [id])) as FeedbackDetailRow | undefined;
  if (!row) return null;
  const imageRows = (await db.query(`SELECT image_path
       FROM feedback_images
       WHERE feedback_id = ?
       ORDER BY sort_order ASC, id ASC`, [id])) as Array<{ image_path: string }>;
  return {
    ...mapListRow(row, false),
    device: parseDevice(row.device_json),
    images: imageRows
      .map((image) => normalizeImageUrl(image.image_path))
      .filter((url): url is string => Boolean(url)),
  };
}

export async function updateAdminFeedbackStatus(id: string, status: FeedbackStatus): Promise<AdminFeedbackDetail | null> {
  const processedAt = status === "processed" ? new Date().toISOString() : null;
  const result = (await getAppDb().execute("UPDATE feedback SET status = ?, processed_at = ? WHERE id = ?", [status, processedAt, id]));
  if (result.affectedRows === 0) return null;
  return (await readAdminFeedbackDetail(id));
}

export async function deleteAdminFeedback(id: string): Promise<boolean> {
  const db = getAppDb();
  const imageRows = (await db.query("SELECT image_path FROM feedback_images WHERE feedback_id = ?", [id])) as Array<{ image_path: string }>;

  const result = (await db.execute("DELETE FROM feedback WHERE id = ?", [id]));
  if (result.affectedRows === 0) return false;

  for (const img of imageRows) {
    if (img.image_path) {
      try {
        const fullPath = path.resolve(process.cwd(), img.image_path);
        unlinkSync(fullPath);
      } catch {
        /* ignore missing files */
      }
    }
  }

  return true;
}

