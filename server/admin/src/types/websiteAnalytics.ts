export type WebsiteRecordFilter = {
  domain?: string;
  startDay?: string;
  endDay?: string;
};

export type WebsiteAnalyticsMetrics = {
  uv: number;
  pv: number;
  downloads: number;
  androidDownloads: number;
  desktopDownloads: number;
};

export type WebsiteAnalyticsData = {
  days: 7 | 30 | 90;
  startDay: string;
  endDay: string;
  summary: WebsiteAnalyticsMetrics;
  trend: Array<WebsiteAnalyticsMetrics & { day: string }>;
  domains: Array<WebsiteAnalyticsMetrics & { domain: string }>;
  topPages: Array<{ path: string; pv: number }>;
};
