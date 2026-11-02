export type ShareRecord = {
  id: string; code: string; userId: string | null; userName: string; userMissing: boolean;
  deviceId: string; deviceKind: string; deviceName: string; deviceMissing: boolean;
  createdAt: number; lastRequestedAt: number; lastVisitAt: number | null; lastDownloadAt: number | null;
  valid: boolean; invalidatedAt: number | null; visitCount: number; visitUv: number;
  androidDownloadCount: number; desktopDownloadCount: number; downloadCount: number; url: string;
};
export type ShareFilter = {
  keyword?: string; valid?: "true" | "false" | "all";
  timeField?: "createdAt" | "lastVisitAt" | "lastDownloadAt"; from?: number; to?: number;
  sort?: "createdAt" | "visitCount" | "downloadCount" | "lastActiveAt";
};
export type ShareTrend = { day: string; visitCount: number; visitUv: number; androidDownloadCount: number; desktopDownloadCount: number; downloadCount: number };
export type ShareSummary = Omit<ShareTrend, "day"> & { total: number; validCount: number; invalidCount: number; conversionRate: number | null };
export type ShareRecordPage = { items: ShareRecord[]; total: number; offset: number; limit: number; summary: ShareSummary; trend: ShareTrend[] };
export type ShareVisit = { eventId: string; visitDay: string; openedAt: number; receivedAt: number; referrerPath: string; userAgent: string; browserDeviceType: string; isUniqueForShareDay: boolean };
export type ShareDownload = { id: string; platform: string; version: string; triggeredAt: number; attributionSource: string; referrerPath: string; userAgent: string };
export type ShareDetail = { record: ShareRecord; trend: ShareTrend[]; visits: { items: ShareVisit[]; total: number }; downloads: { items: ShareDownload[]; total: number }; retentionDays: number };
