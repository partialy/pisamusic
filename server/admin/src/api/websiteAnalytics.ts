import { fetchWithAuth, parseJson } from "./client";
import type { WebsiteAnalyticsData } from "../types/websiteAnalytics";

export async function fetchWebsiteAnalytics(
  days: 7 | 30 | 90,
  domain?: string,
  signal?: AbortSignal,
): Promise<WebsiteAnalyticsData> {
  const params = new URLSearchParams({ days: String(days) });
  if (domain !== undefined) params.set("domain", domain);
  const res = await fetchWithAuth(`/api/admin/website-records/stats?${params}`, { signal });
  const body = await parseJson<WebsiteAnalyticsData>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}
