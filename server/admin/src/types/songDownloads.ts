export type SongDownloadSubjectType = "user" | "device";

export type QuotaLimits = {
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  total: number | null;
};

export type QuotaDimensionSnapshot = {
  limit: number | null;
  used: number;
  remaining: number | null;
};

export type SongDownloadOverviewStats = {
  days: number;
  totalDownloads: number;
  totalBatches: number;
  todayDownloads: number;
  periodDownloads: number;
  bySource: Array<{ source: string; count: number }>;
  byPlatform: Array<{ platform: string; count: number }>;
  trend: Array<{ day: string; downloads: number; batches: number }>;
};

export type TopDownloadedSongItem = {
  source: string;
  songId: string;
  songName: string;
  singer: string;
  album: string;
  coverUrl: string;
  downloadCount: number;
  uniqueSubjects: number;
  lastDownloadedAt: number;
};

export type SongDownloadRecordItem = {
  id: string;
  batchId: string;
  subjectType: SongDownloadSubjectType;
  subjectKey: string;
  userId: string | null;
  username: string | null;
  deviceKind: "android" | "desktop";
  deviceId: string;
  deviceName: string | null;
  platform: "android" | "desktop";
  source: string;
  songId: string;
  songName: string;
  singer: string;
  album: string;
  coverUrl: string;
  durationMs: number | null;
  qualityKey: string;
  downloadDay: string;
  createdAt: number;
};

export type AdminQuotaStateItem = {
  subjectType: SongDownloadSubjectType;
  subjectKey: string;
  overrideEnabled: boolean;
  daily: QuotaDimensionSnapshot;
  weekly: QuotaDimensionSnapshot;
  monthly: QuotaDimensionSnapshot;
  total: QuotaDimensionSnapshot;
  displayName: string;
  secondaryLabel: string;
  updatedAt: number;
};

export type QuotaOverridePayload = {
  overrideEnabled: boolean;
  dailyLimit: number | null;
  weeklyLimit: number | null;
  monthlyLimit: number | null;
  totalLimit: number | null;
  resetDayUsed?: boolean;
  resetWeekUsed?: boolean;
  resetMonthUsed?: boolean;
  resetTotalUsed?: boolean;
};
