import { getAppDb } from "./appDb";

export const WEBSITE_RECORD_TYPES = ["visit", "download"] as const;
export type WebsiteRecordType = (typeof WEBSITE_RECORD_TYPES)[number];

export type AdminSiteVisitListItem = {
  id: string;
  visitDay: string;
  path: string;
  referrer: string;
  ipAddress: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  createdAt: number;
};

export type AdminSiteVisitDetail = AdminSiteVisitListItem & {
  visitorHash: string;
  userAgent: string;
  timezone: string;
};

export type AdminDownloadListItem = {
  id: string;
  downloadDay: string;
  platform: "android" | "desktop";
  version: string;
  fileRecordId: string | null;
  ipAddress: string;
  createdAt: number;
};

export type AdminDownloadDetail = AdminDownloadListItem & {
  referrer: string;
  userAgent: string;
};

export type AdminWebsiteRecordListItem = AdminSiteVisitListItem | AdminDownloadListItem;
export type AdminWebsiteRecordDetail = AdminSiteVisitDetail | AdminDownloadDetail;

export type AdminWebsiteRecordListResult = {
  items: AdminWebsiteRecordListItem[];
  total: number;
  offset: number;
  limit: number;
};

type SiteVisitRow = {
  id: string;
  visit_day: string;
  visitor_hash: string;
  ip_address: string;
  path: string;
  referrer: string;
  user_agent: string;
  language: string;
  timezone: string;
  screen_width: number;
  screen_height: number;
  created_at: number;
};

type DownloadRow = {
  id: string;
  download_day: string;
  platform: "android" | "desktop";
  version: string;
  file_record_id: string | null;
  ip_address: string;
  referrer: string;
  user_agent: string;
  created_at: number;
};

function normalizePagination(offset: unknown, limit: unknown): { offset: number; limit: number } {
  return {
    offset: Math.max(0, Math.trunc(Number(offset) || 0)),
    limit: Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20))),
  };
}

function mapSiteVisitListItem(row: SiteVisitRow): AdminSiteVisitListItem {
  return {
    id: row.id,
    visitDay: row.visit_day,
    path: row.path,
    referrer: row.referrer,
    ipAddress: row.ip_address,
    language: row.language,
    screenWidth: Number(row.screen_width) || 0,
    screenHeight: Number(row.screen_height) || 0,
    createdAt: Number(row.created_at) || 0,
  };
}

function mapSiteVisitDetail(row: SiteVisitRow): AdminSiteVisitDetail {
  return {
    ...mapSiteVisitListItem(row),
    visitorHash: row.visitor_hash,
    userAgent: row.user_agent,
    timezone: row.timezone,
  };
}

function mapDownloadListItem(row: DownloadRow): AdminDownloadListItem {
  return {
    id: row.id,
    downloadDay: row.download_day,
    platform: row.platform,
    version: row.version,
    fileRecordId: row.file_record_id,
    ipAddress: row.ip_address,
    createdAt: Number(row.created_at) || 0,
  };
}

function mapDownloadDetail(row: DownloadRow): AdminDownloadDetail {
  return {
    ...mapDownloadListItem(row),
    referrer: row.referrer,
    userAgent: row.user_agent,
  };
}

export function listAdminWebsiteRecords(
  type: WebsiteRecordType,
  pagination: { offset?: unknown; limit?: unknown },
): AdminWebsiteRecordListResult {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(pagination.offset, pagination.limit);

  if (type === "visit") {
    const totalRow = db.prepare("SELECT COUNT(*) AS total FROM site_visit_records").get() as { total: number };
    const rows = db
      .prepare(
        `SELECT
          id, visit_day, visitor_hash, ip_address, path, referrer,
          user_agent, language, timezone, screen_width, screen_height, created_at
         FROM site_visit_records
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as SiteVisitRow[];
    return {
      items: rows.map(mapSiteVisitListItem),
      total: Number(totalRow.total) || 0,
      offset,
      limit,
    };
  }

  const totalRow = db.prepare("SELECT COUNT(*) AS total FROM download_records").get() as { total: number };
  const rows = db
    .prepare(
      `SELECT
        id, download_day, platform, version, file_record_id,
        ip_address, referrer, user_agent, created_at
       FROM download_records
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as DownloadRow[];
  return {
    items: rows.map(mapDownloadListItem),
    total: Number(totalRow.total) || 0,
    offset,
    limit,
  };
}

export function readAdminWebsiteRecordDetail(
  type: WebsiteRecordType,
  id: string,
): AdminWebsiteRecordDetail | null {
  const db = getAppDb();
  if (type === "visit") {
    const row = db
      .prepare(
        `SELECT
          id, visit_day, visitor_hash, ip_address, path, referrer,
          user_agent, language, timezone, screen_width, screen_height, created_at
         FROM site_visit_records
         WHERE id = ?`,
      )
      .get(id) as SiteVisitRow | undefined;
    return row ? mapSiteVisitDetail(row) : null;
  }

  const row = db
    .prepare(
      `SELECT
        id, download_day, platform, version, file_record_id,
        ip_address, referrer, user_agent, created_at
       FROM download_records
       WHERE id = ?`,
    )
    .get(id) as DownloadRow | undefined;
  return row ? mapDownloadDetail(row) : null;
}
