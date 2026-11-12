import { getAppDb } from "./appDb";
import { buildShanghaiDayRange } from "../utils/analyticsDate";

type Metrics = { uv: number; pv: number; downloads: number; androidDownloads: number; desktopDownloads: number };
const empty = (): Metrics => ({ uv: 0, pv: 0, downloads: 0, androidDownloads: 0, desktopDownloads: 0 });

export async function readWebsiteStats(days: 7 | 30 | 90, domain?: string, now = Date.now()) {
  const db = getAppDb();
  const { dates } = buildShanghaiDayRange(days, now);
  const startDay = dates[0]!;
  const endDay = dates[dates.length - 1]!;
  const condition = domain === undefined ? "" : " AND domain = ?";
  const params = domain === undefined ? [startDay, endDay] : [startDay, endDay, domain];
  // 同一快照，避免采集并发写入导致汇总与图表不一致。
  return db.transaction(async tx => {
    const visits = await tx.query<{ domain: string; day: string; total: number }>(`SELECT domain, visit_day AS day, COUNT(*) AS total
      FROM site_visit_records WHERE visit_day BETWEEN ? AND ?${condition} GROUP BY domain, visit_day`, params);
    const views = await tx.query<{ domain: string; day: string; total: number }>(`SELECT domain, visit_day AS day, COUNT(*) AS total
      FROM site_page_view_records WHERE visit_day BETWEEN ? AND ?${condition} GROUP BY domain, visit_day`, params);
    const downloads = await tx.query<{ domain: string; day: string; platform: string; total: number }>(`SELECT domain, download_day AS day, platform, COUNT(*) AS total
      FROM download_records WHERE download_day BETWEEN ? AND ?${condition} GROUP BY domain, download_day, platform`, params);
    const pages = await tx.query<{ path: string; pv: number }>(`SELECT path, COUNT(*) AS pv FROM site_page_view_records
      WHERE visit_day BETWEEN ? AND ?${condition} GROUP BY path ORDER BY pv DESC, path ASC LIMIT 20`, params);
    const summary = empty();
    const daily = new Map(dates.map(day => [day, { day, ...empty() }]));
    const byDomain = new Map<string, { domain: string } & Metrics>();
    const add = (host: string, day: string, key: keyof Metrics, value: number) => {
      let entry = byDomain.get(host);
      if (!entry) { entry = { domain: host, ...empty() }; byDomain.set(host, entry); }
      entry[key] += value;
      summary[key] += value;
      const point = daily.get(day);
      if (point) point[key] += value;
    };
    visits.forEach(r => add(r.domain, r.day, "uv", Number(r.total)));
    views.forEach(r => add(r.domain, r.day, "pv", Number(r.total)));
    downloads.forEach(r => {
      add(r.domain, r.day, "downloads", Number(r.total));
      add(r.domain, r.day, r.platform === "android" ? "androidDownloads" : "desktopDownloads", Number(r.total));
    });
    return {
      days, startDay, endDay, summary, trend: [...daily.values()],
      domains: [...byDomain.values()].sort((a, b) => b.uv - a.uv || b.pv - a.pv || a.domain.localeCompare(b.domain)),
      topPages: pages.map(r => ({ path: r.path, pv: Number(r.pv) })),
    };
  });
}
