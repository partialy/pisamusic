export type SongDownloadSubjectType = "user" | "device";
export type SongDownloadTierSource = "override" | "vip" | "standard" | "guest";

export type QuotaLimits = {
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  total: number | null;
};

export type VipTierConfig = {
  level: number;
  name: string;
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  total: number | null;
  updatedAt?: number;
};

export type AdminTierPoliciesPayload = {
  guest: QuotaLimits;
  standard: QuotaLimits;
  registerGiftExtraCount: number;
  vipTiers: VipTierConfig[];
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
  clientBatchId: string;
  batchItemCount: number;
  clientIp: string;
  subjectType: SongDownloadSubjectType;
  subjectKey: string;
  userId: string | null;
  username: string | null;
  userEmail: string | null;
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
  isGuest?: boolean;
  overrideEnabled: boolean;
  tierSource?: SongDownloadTierSource;
  extraRemaining: number;
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
  extraBalance?: number;
  extraDelta?: number;
  resetDayUsed?: boolean;
  resetWeekUsed?: boolean;
  resetMonthUsed?: boolean;
  resetTotalUsed?: boolean;
};

export type QuotaTargetRef = {
  subjectType: SongDownloadSubjectType;
  subjectKey: string;
  displayName: string;
  secondaryLabel?: string;
};

export type BatchQuotaOverridePayload = QuotaOverridePayload & {
  targets: Array<{
    subjectType: SongDownloadSubjectType;
    subjectKey: string;
  }>;
};
