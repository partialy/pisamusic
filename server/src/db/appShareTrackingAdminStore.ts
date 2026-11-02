import { getAppDb } from "./appDb";
import { type TrackingRow } from "./appShareTrackingStore";
import { getAnalyticsRetentionDays } from "./analyticsStore";
export type TrackingFilters = {
  keyword?: string;
  valid?: boolean;
  timeField: "createdAt" | "lastVisitAt" | "lastDownloadAt";
  from?: number;
  to?: number;
  sort: "createdAt" | "visitCount" | "downloadCount" | "lastActiveAt";
  offset: number;
  limit: number;
};
const JOIN = ` FROM app_share_records r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN device_info d ON d.id=r.device_id`;
const SELECT = `SELECT r.*,u.username AS live_user_name,d.device_name AS live_device_name,COALESCE((SELECT SUM(visit_uv) FROM app_share_daily_stats s WHERE s.share_record_key=r.id AND s.platform_bucket='all'),0) AS visit_uv`;
type AdminRow = TrackingRow & {
  live_user_name: string | null;
  live_device_name: string | null;
  visit_uv: number;
};
function dto(r: AdminRow) {
  return {
    id: r.id,
    code: r.code,
    userId: r.user_id,
    userName: r.live_user_name ?? JSON.parse(r.user_snapshot_json).name,
    userMissing: !!r.user_id && !r.live_user_name,
    deviceId: r.device_id,
    deviceKind: r.device_kind,
    deviceName: r.live_device_name ?? JSON.parse(r.device_snapshot_json).name,
    deviceMissing: !r.live_device_name,
    createdAt: r.created_at,
    lastRequestedAt: r.last_requested_at,
    lastVisitAt: r.last_visit_at,
    lastDownloadAt: r.last_download_at,
    valid: !!r.valid,
    invalidatedAt: r.invalidated_at,
    visitCount: r.visit_count,
    visitUv: r.visit_uv,
    downloadCount: r.download_count,
    androidDownloadCount: r.android_download_count,
    desktopDownloadCount: r.desktop_download_count,
    url: `https://pisamusic.partialy.cn/app-share/?code=${r.code}`,
  };
}
function where(f: TrackingFilters) {
  const clauses: string[] = [];
  const args: (string | number)[] = [];
  if (f.valid !== undefined) {
    clauses.push("r.valid=?");
    args.push(f.valid ? 1 : 0);
  }
  if (f.keyword) {
    clauses.push(
      "(r.code LIKE ? ESCAPE '\\' OR r.user_id LIKE ? ESCAPE '\\' OR r.device_id LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\' OR r.user_snapshot_json LIKE ? ESCAPE '\\')",
    );
    const q = `%${f.keyword.replace(/[\\%_]/g, "\\$&")}%`;
    args.push(q, q, q, q, q);
  }
  const column = {
    createdAt: "r.created_at",
    lastVisitAt: "r.last_visit_at",
    lastDownloadAt: "r.last_download_at",
  }[f.timeField];
  if (f.from !== undefined) {
    clauses.push(`${column}>=?`);
    args.push(f.from);
  }
  if (f.to !== undefined) {
    clauses.push(`${column}<=?`);
    args.push(f.to);
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", args };
}
function order(f: TrackingFilters) {
  return (
    {
      createdAt: "r.created_at",
      visitCount: "r.visit_count",
      downloadCount: "r.download_count",
      lastActiveAt:
        "MAX(COALESCE(r.last_visit_at,0),COALESCE(r.last_download_at,0),r.created_at)",
    }[f.sort] + " DESC,r.id DESC"
  );
}
type Daily = {
  day: string;
  platform_bucket: string;
  visit_pv: number;
  visit_uv: number;
  download_triggers: number;
};
function trendFromRows(rows: Daily[]) {
  const days = new Map<
    string,
    {
      day: string;
      visitCount: number;
      visitUv: number;
      downloadCount: number;
      androidDownloadCount: number;
      desktopDownloadCount: number;
    }
  >();
  for (const r of rows) {
    const d = days.get(r.day) ?? {
      day: r.day,
      visitCount: 0,
      visitUv: 0,
      downloadCount: 0,
      androidDownloadCount: 0,
      desktopDownloadCount: 0,
    };
    if (r.platform_bucket === "all") {
      d.visitCount += r.visit_pv;
      d.visitUv += r.visit_uv;
      d.downloadCount += r.download_triggers;
    } else if (r.platform_bucket === "android")
      d.androidDownloadCount += r.download_triggers;
    else d.desktopDownloadCount += r.download_triggers;
    days.set(r.day, d);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}
export function listTrackingRecords(f: TrackingFilters, exportAll = false) {
  const db = getAppDb();
  const w = where(f);
  const total = Number(
    (
      db.prepare("SELECT COUNT(*) AS n" + JOIN + w.sql).get(...w.args) as {
        n: number;
      }
    ).n,
  );
  const rows = db
    .prepare(
      SELECT +
        JOIN +
        w.sql +
        ` ORDER BY ${order(f)}` +
        (exportAll ? "" : " LIMIT ? OFFSET ?"),
    )
    .all(...w.args, ...(exportAll ? [] : [f.limit, f.offset])) as AdminRow[];
  const sums = db
    .prepare(
      `SELECT COUNT(*) AS total,COALESCE(SUM(r.valid),0) AS validCount,COALESCE(SUM(r.visit_count),0) AS visitCount,COALESCE(SUM(r.download_count),0) AS downloadCount,COALESCE(SUM(r.android_download_count),0) AS androidDownloadCount,COALESCE(SUM(r.desktop_download_count),0) AS desktopDownloadCount` +
        JOIN +
        w.sql,
    )
    .get(...w.args) as {
    total: number;
    validCount: number;
    visitCount: number;
    downloadCount: number;
    androidDownloadCount: number;
    desktopDownloadCount: number;
  };
  // 无筛选时读取独立全站UV；有身份筛选时按选中短码累计日UV，避免冒称全站独立访客。
  const filtered =
    !!f.keyword ||
    f.valid !== undefined ||
    f.from !== undefined ||
    f.to !== undefined;
  const daily = db
    .prepare(
      filtered
        ? `SELECT s.* FROM app_share_daily_stats s WHERE s.scope='record' AND s.share_record_key IN (SELECT r.id${JOIN}${w.sql})`
        : `SELECT * FROM app_share_daily_stats WHERE scope='global'`,
    )
    .all(...(filtered ? w.args : [])) as Daily[];
  const trend = trendFromRows(daily);
  const summary = {
    ...sums,
    invalidCount: total - sums.validCount,
    visitUv: trend.reduce((n, d) => n + d.visitUv, 0),
    conversionRate: sums.visitCount
      ? sums.downloadCount / sums.visitCount
      : null,
  };
  return {
    items: rows.map(dto),
    total,
    offset: f.offset,
    limit: f.limit,
    summary,
    trend,
  };
}
export function trackingRecordDetail(
  id: string,
  visitOffset: number,
  downloadOffset: number,
  limit: number,
) {
  const db = getAppDb();
  const row = db.prepare(SELECT + JOIN + " WHERE r.id=?").get(id) as
    AdminRow | undefined;
  if (!row) return null;
  const visits = db
    .prepare(
      `SELECT event_id AS eventId,visit_day AS visitDay,opened_at AS openedAt,received_at AS receivedAt,referrer_path AS referrerPath,user_agent AS userAgent,browser_device_type AS browserDeviceType,is_unique_for_share_day AS isUniqueForShareDay FROM app_share_visits WHERE share_record_id=? ORDER BY received_at DESC,event_id DESC LIMIT ? OFFSET ?`,
    )
    .all(id, limit, visitOffset);
  const downloads = db
    .prepare(
      `SELECT id,platform,version,triggered_at AS triggeredAt,attribution_source AS attributionSource,safe_referrer_path AS referrerPath,safe_user_agent AS userAgent FROM app_share_downloads WHERE share_record_id=? ORDER BY triggered_at DESC,id DESC LIMIT ? OFFSET ?`,
    )
    .all(id, limit, downloadOffset);
  const count = (table: string) =>
    Number(
      (
        db
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE share_record_id=?`)
          .get(id) as {
          n: number;
        }
      ).n,
    );
  return {
    record: dto(row),
    trend: trendFromRows(
      db
        .prepare("SELECT * FROM app_share_daily_stats WHERE share_record_key=?")
        .all(id) as Daily[],
    ),
    visits: { items: visits, total: count("app_share_visits") },
    downloads: { items: downloads, total: count("app_share_downloads") },
    retentionDays: getAnalyticsRetentionDays(),
  };
}
