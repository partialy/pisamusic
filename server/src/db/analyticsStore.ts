import { createHash, randomUUID } from "node:crypto";
import { getAppDb } from "./appDb";
import { toShanghaiDay } from "../utils/analyticsDate";

export type SiteVisitInput = {
  visitorId: string;
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

export function maybeCleanupAnalytics(now = Date.now()): void {
  const today = toShanghaiDay(now);
  if (lastCleanupDay === today) return;

  try {
    const db = getAppDb();
    const retentionDays = getAnalyticsRetentionDays();
    const cutoffTimestamp = now - retentionDays * 24 * 60 * 60 * 1000;

    db.prepare("DELETE FROM site_visit_records WHERE created_at < ?").run(cutoffTimestamp);
    db.prepare("DELETE FROM download_records WHERE created_at < ?").run(cutoffTimestamp);
    db.prepare("DELETE FROM device_daily_activity WHERE last_seen_at < ?").run(cutoffTimestamp);
    lastCleanupDay = today;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[analytics] retention cleanup failed:", err);
  }
}

export function recordSiteVisit(input: SiteVisitInput): { accepted: boolean; visitDay: string } {
  const now = input.occurredAt ?? Date.now();
  const visitDay = toShanghaiDay(now);
  const visitorHash = hashVisitorId(input.visitorId);
  const id = randomUUID();

  maybeCleanupAnalytics(now);

  const db = getAppDb();
  const stmt = db.prepare(`
    INSERT INTO site_visit_records (
      id, visit_day, visitor_hash, ip_address, path, referrer,
      user_agent, language, timezone, screen_width, screen_height, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(visit_day, visitor_hash) DO NOTHING
  `);

  const result = stmt.run(
    id,
    visitDay,
    visitorHash,
    input.ipAddress || "",
    input.path || "/",
    input.referrer || "",
    input.userAgent || "",
    input.language || "",
    input.timezone || "",
    Math.max(0, Math.trunc(input.screenWidth || 0)),
    Math.max(0, Math.trunc(input.screenHeight || 0)),
    now,
  );

  return {
    accepted: Number(result.changes) === 1,
    visitDay,
  };
}

export function recordDeviceDailyActivity(input: DeviceDailyActivityInput): void {
  const now = input.occurredAt ?? Date.now();
  const activityDay = toShanghaiDay(now);

  maybeCleanupAnalytics(now);

  const db = getAppDb();
  db.prepare(`
    INSERT INTO device_daily_activity (
      activity_day, device_type, device_id, app_version, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(activity_day, device_type, device_id) DO UPDATE SET
      app_version = excluded.app_version,
      last_seen_at = excluded.last_seen_at
  `).run(
    activityDay,
    input.deviceType,
    input.deviceId,
    input.appVersion || "",
    now,
    now,
  );
}

export function recordDownload(input: DownloadRecordInput): void {
  const now = input.occurredAt ?? Date.now();
  const downloadDay = toShanghaiDay(now);
  const id = randomUUID();

  maybeCleanupAnalytics(now);

  const db = getAppDb();
  db.prepare(`
    INSERT INTO download_records (
      id, download_day, platform, version, file_record_id,
      ip_address, referrer, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    downloadDay,
    input.platform,
    input.version || "",
    input.fileRecordId || null,
    input.ipAddress || "",
    input.referrer || "",
    input.userAgent || "",
    now,
  );
}
