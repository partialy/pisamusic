import type { PaginatedListData } from "../types/response";
import { buildPaginatedList, normalizePagination } from "../utils/pagination";
import { getAppDb } from "./appDb";

export const WEBSITE_RECORD_TYPES = ["visit", "download"] as const;
export type WebsiteRecordType = (typeof WEBSITE_RECORD_TYPES)[number];

export type AdminSiteVisitListItem = {
  id: string;
  domain: string;
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
  domain: string;
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

export type AdminWebsiteRecordListResult = PaginatedListData<AdminWebsiteRecordListItem>;

type SiteVisitRow = {
  id: string;
  domain: string;
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
  domain: string;
  download_day: string;
  platform: "android" | "desktop";
  version: string;
  file_record_id: string | null;
  ip_address: string;
  referrer: string;
  user_agent: string;
  created_at: number;
};

function mapSiteVisitListItem(row: SiteVisitRow): AdminSiteVisitListItem {
  return {
    id: row.id,
    domain: row.domain,
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
    domain: row.domain,
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

export async function listAdminWebsiteRecords(
  type: WebsiteRecordType,
  pagination: { offset?: unknown; limit?: unknown; domain?: string; startDay?: string; endDay?: string },
): Promise<AdminWebsiteRecordListResult> {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(pagination.offset, pagination.limit);

  const filters: string[] = [];
  const params: string[] = [];
  const dayColumn = type === "visit" ? "visit_day" : "download_day";
  if (pagination.domain !== undefined) { filters.push("domain = ?"); params.push(pagination.domain); }
  if (pagination.startDay) { filters.push(`${dayColumn} >= ?`); params.push(pagination.startDay); }
  if (pagination.endDay) { filters.push(`${dayColumn} <= ?`); params.push(pagination.endDay); }
  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  if (type === "visit") {
    const totalRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM site_visit_records${where}`, params)) as { total: number };
    const rows = (await db.query(`SELECT
          id, domain, visit_day, visitor_hash, ip_address, path, referrer,
          user_agent, language, timezone, screen_width, screen_height, created_at
         FROM site_visit_records${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`, [...params, limit, offset])) as SiteVisitRow[];
    return buildPaginatedList(
      rows.map(mapSiteVisitListItem),
      totalRow.total,
      offset,
      limit,
    );
  }

  const totalRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM download_records${where}`, params)) as { total: number };
  const rows = (await db.query(`SELECT
        id, domain, download_day, platform, version, file_record_id,
        ip_address, referrer, user_agent, created_at
       FROM download_records${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset])) as DownloadRow[];
  return buildPaginatedList(
    rows.map(mapDownloadListItem),
    totalRow.total,
    offset,
    limit,
  );
}

export async function readAdminWebsiteRecordDetail(
  type: WebsiteRecordType,
  id: string,
): Promise<AdminWebsiteRecordDetail | null> {
  const db = getAppDb();
  if (type === "visit") {
    const row = (await db.queryOne(`SELECT
          id, domain, visit_day, visitor_hash, ip_address, path, referrer,
          user_agent, language, timezone, screen_width, screen_height, created_at
         FROM site_visit_records
         WHERE id = ?`, [id])) as SiteVisitRow | undefined;
    return row ? mapSiteVisitDetail(row) : null;
  }

  const row = (await db.queryOne(`SELECT
        id, domain, download_day, platform, version, file_record_id,
        ip_address, referrer, user_agent, created_at
       FROM download_records
       WHERE id = ?`, [id])) as DownloadRow | undefined;
  return row ? mapDownloadDetail(row) : null;
}
