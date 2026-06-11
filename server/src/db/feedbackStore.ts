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
};

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

export type AdminFeedbackListResult = {
  items: AdminFeedbackListItem[];
  total: number;
  offset: number;
  limit: number;
};

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

function normalizePagination(offset: unknown, limit: unknown): { offset: number; limit: number } {
  return {
    offset: Math.max(0, Math.trunc(Number(offset) || 0)),
    limit: Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20))),
  };
}

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

export function insertFeedback(item: FeedbackCreateInput): void {
  const db = getAppDb();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT OR IGNORE INTO feedback (
        id, created_at, feedback_type, description, contact, device_json, status, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL)`,
    ).run(
      item.id,
      item.createdAt,
      item.feedbackType,
      item.description,
      item.contact,
      JSON.stringify(item.device ?? {}),
    );
    const insertImage = db.prepare(
      `INSERT INTO feedback_images (feedback_id, image_path, sort_order)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM feedback_images WHERE feedback_id = ? AND image_path = ?
       )`,
    );
    item.imagePaths.forEach((imagePath, index) => {
      insertImage.run(item.id, imagePath, index, item.id, imagePath);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listAdminFeedback(filter: AdminFeedbackFilter): AdminFeedbackListResult {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(filter.offset, filter.limit);
  const where = buildWhere(filter);
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM feedback f ${where.sql}`)
    .get(...where.params) as { total: number };
  const rows = db
    .prepare(
      `${LIST_SELECT}
       ${where.sql}
       GROUP BY f.id
       ORDER BY f.created_at DESC, f.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...where.params, limit, offset) as FeedbackListRow[];
  return {
    items: rows.map((row) => mapListRow(row)),
    total: Number(totalRow.total) || 0,
    offset,
    limit,
  };
}

export function readAdminFeedbackDetail(id: string): AdminFeedbackDetail | null {
  const db = getAppDb();
  const row = db
    .prepare(
      `SELECT
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
       LIMIT 1`,
    )
    .get(id) as FeedbackDetailRow | undefined;
  if (!row) return null;
  const imageRows = db
    .prepare(
      `SELECT image_path
       FROM feedback_images
       WHERE feedback_id = ?
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(id) as Array<{ image_path: string }>;
  return {
    ...mapListRow(row, false),
    device: parseDevice(row.device_json),
    images: imageRows
      .map((image) => normalizeImageUrl(image.image_path))
      .filter((url): url is string => Boolean(url)),
  };
}

export function updateAdminFeedbackStatus(id: string, status: FeedbackStatus): AdminFeedbackDetail | null {
  const processedAt = status === "processed" ? new Date().toISOString() : null;
  const result = getAppDb()
    .prepare("UPDATE feedback SET status = ?, processed_at = ? WHERE id = ?")
    .run(status, processedAt, id);
  if (result.changes === 0) return null;
  return readAdminFeedbackDetail(id);
}
