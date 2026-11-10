import { getAppDb } from "./appDb";
import {
  buildShanghaiDayRange,
  shanghaiDayStart,
  toShanghaiDay,
} from "../utils/analyticsDate";
import type {
  AdminDashboardData,
  DashboardDailyPoint,
  DashboardNamedValue,
  DashboardRangeDays,
} from "../types/dashboard";

function aggregateTopVersions(rows: { name: string; count: number }[]): DashboardNamedValue[] {
  if (rows.length <= 6) {
    return rows.map((r) => ({ name: r.name, value: Number(r.count) }));
  }
  const top6 = rows.slice(0, 6).map((r) => ({ name: r.name, value: Number(r.count) }));
  const otherSum = rows.slice(6).reduce((acc, r) => acc + Number(r.count), 0);
  if (otherSum > 0) {
    top6.push({ name: "其他", value: otherSum });
  }
  return top6;
}

export async function readAdminDashboard(
  days: DashboardRangeDays = 30,
  now = Date.now(),
): Promise<AdminDashboardData> {
  const db = getAppDb();
  const { startAt, dates } = buildShanghaiDayRange(days, now);
  const startDateStr = dates[0] ?? toShanghaiDay(now);

  const { startAt: sevenDaysStartAt, dates: sevenDaysDates } = buildShanghaiDayRange(7, now);
  const sevenDaysStartStr = sevenDaysDates[0] ?? startDateStr;

  const today = toShanghaiDay(now);
  const todayStartAt = shanghaiDayStart(today);

  // Initialize zero-filled daily map
  const dailyMap = new Map<string, DashboardDailyPoint>();
  for (const date of dates) {
    dailyMap.set(date, {
      date,
      newUsers: 0,
      totalUsers: 0,
      newAndroidDevices: 0,
      newDesktopDevices: 0,
      activeAndroidDevices: 0,
      activeDesktopDevices: 0,
      siteVisits: 0,
      androidDownloads: 0,
      desktopDownloads: 0,
    });
  }

  // 1. New users per day
  type DayCountRow = { day: string; cnt: number };
  const userRows = (await db.query(db.dialect === "mysql" ? "SELECT DATE_FORMAT(TIMESTAMPADD(SECOND, FLOOR(created_at / 1000) + 28800, '1970-01-01'), '%Y-%m-%d') AS day, COUNT(*) AS cnt\n       FROM users\n       WHERE created_at >= ?\n       GROUP BY day" : `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', '+8 hours') AS day, COUNT(*) AS cnt
       FROM users
       WHERE created_at >= ?
       GROUP BY day`, [startAt])) as DayCountRow[];
  for (const row of userRows) {
    const point = dailyMap.get(row.day);
    if (point) point.newUsers = Number(row.cnt);
  }

  // 2. Users baseline before range
  const baselineRow = (await db.queryOne(`SELECT COUNT(*) AS cnt FROM users WHERE created_at < ?`, [startAt])) as { cnt: number };
  const baselineUsers = Number(baselineRow?.cnt ?? 0);

  // 3. New Android devices per day
  const androidDevRows = (await db.query(db.dialect === "mysql" ? "SELECT DATE_FORMAT(TIMESTAMPADD(SECOND, FLOOR(first_seen_at / 1000) + 28800, '1970-01-01'), '%Y-%m-%d') AS day, COUNT(*) AS cnt\n       FROM device_info\n       WHERE first_seen_at >= ?\n       GROUP BY day" : `SELECT strftime('%Y-%m-%d', first_seen_at / 1000, 'unixepoch', '+8 hours') AS day, COUNT(*) AS cnt
       FROM device_info
       WHERE first_seen_at >= ?
       GROUP BY day`, [startAt])) as DayCountRow[];
  for (const row of androidDevRows) {
    const point = dailyMap.get(row.day);
    if (point) point.newAndroidDevices = Number(row.cnt);
  }

  // 4. New Desktop devices per day
  const desktopDevRows = (await db.query(db.dialect === "mysql" ? "SELECT DATE_FORMAT(TIMESTAMPADD(SECOND, FLOOR(first_seen_at / 1000) + 28800, '1970-01-01'), '%Y-%m-%d') AS day, COUNT(*) AS cnt\n       FROM desktop_device_info\n       WHERE first_seen_at >= ?\n       GROUP BY day" : `SELECT strftime('%Y-%m-%d', first_seen_at / 1000, 'unixepoch', '+8 hours') AS day, COUNT(*) AS cnt
       FROM desktop_device_info
       WHERE first_seen_at >= ?
       GROUP BY day`, [startAt])) as DayCountRow[];
  for (const row of desktopDevRows) {
    const point = dailyMap.get(row.day);
    if (point) point.newDesktopDevices = Number(row.cnt);
  }

  // 5. Active devices per day (Android)
  const activeAndroidRows = (await db.query(`SELECT activity_day AS day, COUNT(DISTINCT device_id) AS cnt
       FROM device_daily_activity
       WHERE device_type = 'android' AND activity_day >= ?
       GROUP BY activity_day`, [startDateStr])) as DayCountRow[];
  for (const row of activeAndroidRows) {
    const point = dailyMap.get(row.day);
    if (point) point.activeAndroidDevices = Number(row.cnt);
  }

  // 6. Active devices per day (Desktop)
  const activeDesktopRows = (await db.query(`SELECT activity_day AS day, COUNT(DISTINCT device_id) AS cnt
       FROM device_daily_activity
       WHERE device_type = 'desktop' AND activity_day >= ?
       GROUP BY activity_day`, [startDateStr])) as DayCountRow[];
  for (const row of activeDesktopRows) {
    const point = dailyMap.get(row.day);
    if (point) point.activeDesktopDevices = Number(row.cnt);
  }

  // 7. Site visits (UV) per day
  const siteVisitRows = (await db.query(`SELECT visit_day AS day, COUNT(DISTINCT visitor_hash) AS cnt
       FROM site_visit_records
       WHERE visit_day >= ?
       GROUP BY visit_day`, [startDateStr])) as DayCountRow[];
  for (const row of siteVisitRows) {
    const point = dailyMap.get(row.day);
    if (point) point.siteVisits = Number(row.cnt);
  }

  // 8. Downloads per day
  type DownloadDayRow = { day: string; platform: string; cnt: number };
  const downloadRows = (await db.query(`SELECT download_day AS day, platform, COUNT(*) AS cnt
       FROM download_records
       WHERE download_day >= ?
       GROUP BY download_day, platform`, [startDateStr])) as DownloadDayRow[];
  for (const row of downloadRows) {
    const point = dailyMap.get(row.day);
    if (point) {
      if (row.platform === "android") {
        point.androidDownloads = Number(row.cnt);
      } else if (row.platform === "desktop") {
        point.desktopDownloads = Number(row.cnt);
      }
    }
  }

  // Build daily points array with running totalUsers
  let runningUsers = baselineUsers;
  const daily: DashboardDailyPoint[] = [];
  for (const date of dates) {
    const point = dailyMap.get(date)!;
    runningUsers += point.newUsers;
    point.totalUsers = runningUsers;
    daily.push(point);
  }

  // Summary Metrics
  const totalUsersRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM users`, [])) as { total: number };
  const newUsersTodayRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM users WHERE created_at >= ?`, [todayStartAt])) as { total: number };
  const newUsers7dRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM users WHERE created_at >= ?`, [sevenDaysStartAt])) as { total: number };
  const loggedInUsers7dRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM users WHERE last_login_at IS NOT NULL AND last_login_at >= ?`, [sevenDaysStartAt])) as { total: number };

  const androidDevicesRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM device_info`, [])) as { total: number };
  const desktopDevicesRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM desktop_device_info`, [])) as { total: number };
  const androidDevices = Number(androidDevicesRow?.total ?? 0);
  const desktopDevices = Number(desktopDevicesRow?.total ?? 0);

  const activeDevices7dRow = (await db.queryOne(db.dialect === "mysql" ? "SELECT COUNT(DISTINCT CONCAT(device_type, ':', device_id)) AS total\n       FROM device_daily_activity\n       WHERE activity_day >= ?" : `SELECT COUNT(DISTINCT device_type || ':' || device_id) AS total
       FROM device_daily_activity
       WHERE activity_day >= ?`, [sevenDaysStartStr])) as { total: number };

  const siteVisitsTodayRow = (await db.queryOne(`SELECT COUNT(DISTINCT visitor_hash) AS total FROM site_visit_records WHERE visit_day = ?`, [today])) as { total: number };
  const siteVisits7dRow = (await db.queryOne(`SELECT COUNT(*) AS total
       FROM site_visit_records
       WHERE visit_day >= ?`, [sevenDaysStartStr])) as { total: number };

  const downloadsTodayRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM download_records WHERE download_day = ?`, [today])) as { total: number };
  const downloads7dRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM download_records WHERE download_day >= ?`, [sevenDaysStartStr])) as { total: number };

  const siteVisits7d = Number(siteVisits7dRow?.total ?? 0);
  const downloads7d = Number(downloads7dRow?.total ?? 0);
  const downloadConversion7d =
    siteVisits7d > 0 ? Math.round((downloads7d / siteVisits7d) * 1000) / 10 : 0;

  const pendingFeedbackRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM feedback WHERE status = 'pending'`, [])) as { total: number };
  const pendingFaultReportsRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM fault_reports WHERE status = 'pending'`, [])) as { total: number };
  const validSharesRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM share_records WHERE valid = 1`, [])) as { total: number };
  const shareAccessesRow = (await db.queryOne(`SELECT COALESCE(SUM(access_count), 0) AS total FROM share_records`, [])) as { total: number };
  const syncedLibraryItemsRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM user_sync_items WHERE deleted = 0`, [])) as { total: number };
  const uploadedFilesRow = (await db.queryOne(`SELECT COUNT(*) AS total, COALESCE(SUM(file_size), 0) AS total_bytes FROM file_records WHERE status = 'uploaded'`, [])) as { total: number; total_bytes: number };

  // Distributions
  type VersionGroupRow = { name: string; count: number };
  const androidVersionRows = (await db.query(`SELECT app_version AS name, COUNT(*) AS count
       FROM device_info
       WHERE app_version IS NOT NULL AND TRIM(app_version) <> ''
       GROUP BY app_version
       ORDER BY count DESC`, [])) as VersionGroupRow[];

  const desktopVersionRows = (await db.query(`SELECT app_version AS name, COUNT(*) AS count
       FROM desktop_device_info
       WHERE app_version IS NOT NULL AND TRIM(app_version) <> ''
       GROUP BY app_version
       ORDER BY count DESC`, [])) as VersionGroupRow[];

  type DownloadPlatformRow = { platform: string; count: number };
  const downloadPlatformRows = (await db.query(`SELECT platform, COUNT(*) AS count
       FROM download_records
       WHERE download_day >= ?
       GROUP BY platform`, [startDateStr])) as DownloadPlatformRow[];

  let rangeAndroidDownloads = 0;
  let rangeDesktopDownloads = 0;
  for (const row of downloadPlatformRows) {
    if (row.platform === "android") rangeAndroidDownloads = Number(row.count);
    if (row.platform === "desktop") rangeDesktopDownloads = Number(row.count);
  }

  return {
    rangeDays: days,
    timezone: "Asia/Shanghai",
    generatedAt: now,
    summary: {
      totalUsers: Number(totalUsersRow?.total ?? 0),
      newUsersToday: Number(newUsersTodayRow?.total ?? 0),
      newUsers7d: Number(newUsers7dRow?.total ?? 0),
      loggedInUsers7d: Number(loggedInUsers7dRow?.total ?? 0),
      totalDevices: androidDevices + desktopDevices,
      androidDevices,
      desktopDevices,
      activeDevices7d: Number(activeDevices7dRow?.total ?? 0),
      siteVisitsToday: Number(siteVisitsTodayRow?.total ?? 0),
      siteVisits7d,
      downloadsToday: Number(downloadsTodayRow?.total ?? 0),
      downloads7d,
      downloadConversion7d,
      pendingFeedback: Number(pendingFeedbackRow?.total ?? 0),
      pendingFaultReports: Number(pendingFaultReportsRow?.total ?? 0),
      validShares: Number(validSharesRow?.total ?? 0),
      shareAccesses: Number(shareAccessesRow?.total ?? 0),
      syncedLibraryItems: Number(syncedLibraryItemsRow?.total ?? 0),
      uploadedFiles: Number(uploadedFilesRow?.total ?? 0),
      uploadedFileBytes: Number(uploadedFilesRow?.total_bytes ?? 0),
    },
    daily,
    distributions: {
      devicePlatforms: [
        { name: "Android", value: androidDevices },
        { name: "PC", value: desktopDevices },
      ],
      androidVersions: aggregateTopVersions(androidVersionRows),
      desktopVersions: aggregateTopVersions(desktopVersionRows),
      downloadsByPlatform: [
        { name: "Android", value: rangeAndroidDownloads },
        { name: "PC", value: rangeDesktopDownloads },
      ],
    },
  };
}
