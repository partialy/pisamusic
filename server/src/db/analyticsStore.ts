import { createHash, randomUUID } from "node:crypto";
import { getAppDb } from "./appDb";
import type { DbTransaction } from "./core/types";
import { toShanghaiDay } from "../utils/analyticsDate";

export type SiteVisitInput = {
  visitorId: string;
  domain?: string;
  ipAddress: string;
  path: string;
  referrer: string;
  userAgent: string;
  language: string;
  timezone: string;
  screenWidth: number;
  screenHeight: number;
  occurredAt?: number;
};

export type DeviceDailyActivityInput = {
  deviceType: "android" | "desktop";
  deviceId: string;
  appVersion: string;
  occurredAt?: number;
};

export type DownloadRecordInput = {
  domain?: string;
  platform: "android" | "desktop";
  version: string;
  fileRecordId: string | null;
  ipAddress: string;
  referrer: string;
  userAgent: string;
  occurredAt?: number;
};

let lastCleanupDay = "";

export function getAnalyticsRetentionDays(): number {
  const parsed = Number(process.env.ANALYTICS_RETENTION_DAYS);
  if (Number.isFinite(parsed) && parsed >= 90 && parsed <= 730) {
    return Math.trunc(parsed);
  }
  return 180;
}

export function hashVisitorId(visitorId: string): string {
  const salt = String(
    process.env.ANALYTICS_HASH_SALT || process.env.ADMIN_JWT_SECRET || "pisa-analytics-dev-salt",
  ).trim();
  return createHash("sha256").update(`${salt}${visitorId.trim()}`, "utf8").digest("hex");
}

export async function maybeCleanupAnalytics(now = Date.now()): Promise<void> {
  const today = toShanghaiDay(now);
  if (lastCleanupDay === today) return;

  try {
    const db = getAppDb();
    const retentionDays = getAnalyticsRetentionDays();
    const cutoffTimestamp = now - retentionDays * 24 * 60 * 60 * 1000;

    (await db.execute("DELETE FROM site_visit_records WHERE created_at < ?", [cutoffTimestamp]));
    await db.execute("DELETE FROM site_page_view_records WHERE created_at < ?", [cutoffTimestamp]);
    (await db.execute("DELETE FROM download_records WHERE created_at < ?", [cutoffTimestamp]));
    (await db.execute("DELETE FROM device_daily_activity WHERE last_seen_at < ?", [cutoffTimestamp]));
    (await db.execute("DELETE FROM app_share_visits WHERE received_at < ?", [cutoffTimestamp]));
    (await db.execute("DELETE FROM app_share_downloads WHERE triggered_at < ?", [cutoffTimestamp]));
    lastCleanupDay = today;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[analytics] retention cleanup failed:", err);
  }
}

async function insertUnique(db: DbTransaction, sql: string, values: (string | number)[]): Promise<boolean> {
  try { await db.execute(sql, values); return true; }
  catch (error) {
    const e = error as { code?: string; errcode?: number; message?: string };
    // 不使用 MySQL no-op affectedRows：FOUND_ROWS 模式会把重复事件也返回为 1。
    if (e.code === "ER_DUP_ENTRY" || (e.code === "ERR_SQLITE_ERROR" && /UNIQUE constraint failed/.test(e.message ?? ""))) return false;
    throw error;
  }
}

async function insertSiteVisit(db: DbTransaction, input: SiteVisitInput, now: number): Promise<boolean> {
  return insertUnique(db, `INSERT INTO site_visit_records (
    id, visit_day, domain, visitor_hash, ip_address, path, referrer,
    user_agent, language, timezone, screen_width, screen_height, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    randomUUID(), toShanghaiDay(now), input.domain || "", hashVisitorId(input.visitorId),
    input.ipAddress || "", input.path || "/", input.referrer || "", input.userAgent || "",
    input.language || "", input.timezone || "", Math.max(0, Math.trunc(input.screenWidth || 0)),
    Math.max(0, Math.trunc(input.screenHeight || 0)), now,
  ]);
}

export async function recordSiteVisit(input: SiteVisitInput): Promise<{ accepted: boolean; visitDay: string }> {
  const now = input.occurredAt ?? Date.now();
  await maybeCleanupAnalytics(now);
  return { accepted: await insertSiteVisit(getAppDb(), input, now), visitDay: toShanghaiDay(now) };
}

export async function recordPageView(input: SiteVisitInput & { eventId: string }): Promise<{
  pvAccepted: boolean; uvAccepted: boolean; visitDay: string;
}> {
  const now = input.occurredAt ?? Date.now();
  await maybeCleanupAnalytics(now);
  return getAppDb().transaction(async tx => {
    const pvAccepted = await insertUnique(tx, `INSERT INTO site_page_view_records
      (id, visit_day, domain, visitor_hash, path, referrer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.eventId.toLowerCase(), toShanghaiDay(now), input.domain || "", hashVisitorId(input.visitorId), input.path, input.referrer, now]);
    // 重试跨过午夜时也不应产生另一天的虚假 UV。
    const uvAccepted = pvAccepted ? await insertSiteVisit(tx, input, now) : false;
    return { pvAccepted, uvAccepted, visitDay: toShanghaiDay(now) };
  });
}

export async function recordDeviceDailyActivity(input: DeviceDailyActivityInput): Promise<void> {
  const now = input.occurredAt ?? Date.now();
  const activityDay = toShanghaiDay(now);

  (await maybeCleanupAnalytics(now));

  const db = getAppDb();
  (await db.execute(db.dialect === "mysql" ? "\n    INSERT INTO device_daily_activity (\n      activity_day, device_type, device_id, app_version, first_seen_at, last_seen_at\n    ) VALUES (?, ?, ?, ?, ?, ?)\n    ON DUPLICATE KEY UPDATE\n      app_version = VALUES(app_version),\n      last_seen_at = VALUES(last_seen_at)\n  " : `
    INSERT INTO device_daily_activity (
      activity_day, device_type, device_id, app_version, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(activity_day, device_type, device_id) DO UPDATE SET
      app_version = excluded.app_version,
      last_seen_at = excluded.last_seen_at
  `, [activityDay, input.deviceType, input.deviceId, input.appVersion || "", now, now]));
}

export async function recordDownload(input: DownloadRecordInput): Promise<void> {
  (await maybeCleanupAnalytics(input.occurredAt ?? Date.now()));
  (await insertDownloadRecord(input));
}

export async function insertDownloadRecord(input: DownloadRecordInput): Promise<string> {
  const now = input.occurredAt ?? Date.now();
  const downloadDay = toShanghaiDay(now);
  const id = randomUUID();



  const db = getAppDb();
  (await db.execute(`
    INSERT INTO download_records (
      id, download_day, domain, platform, version, file_record_id,
      ip_address, referrer, user_agent, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, downloadDay, input.domain || "", input.platform, input.version || "", input.fileRecordId || null, input.ipAddress || "", input.referrer || "", input.userAgent || "", now]));
  return id;
}
