export type DashboardDailyPoint = {
  date: string;
  newUsers: number;
  totalUsers: number;
  newAndroidDevices: number;
  newDesktopDevices: number;
  activeAndroidDevices: number;
  activeDesktopDevices: number;
  siteVisits: number;
  androidDownloads: number;
  desktopDownloads: number;
};

export type DashboardNamedValue = {
  name: string;
  value: number;
};

export type DashboardRangeDays = 7 | 30 | 90;
export const DASHBOARD_RANGE_DAYS: readonly DashboardRangeDays[] = [7, 30, 90];

export type AdminDashboardSummary = {
  totalUsers: number;
  newUsersToday: number;
  newUsers7d: number;
  loggedInUsers7d: number;
  totalDevices: number;
  androidDevices: number;
  desktopDevices: number;
  activeDevices7d: number;
  siteVisitsToday: number;
  siteVisits7d: number;
  downloadsToday: number;
  downloads7d: number;
  downloadConversion7d: number;
  pendingFeedback: number;
  pendingFaultReports: number;
  validShares: number;
  shareAccesses: number;
  syncedLibraryItems: number;
  uploadedFiles: number;
  uploadedFileBytes: number;
};

export type AdminDashboardDistributions = {
  devicePlatforms: DashboardNamedValue[];
  androidVersions: DashboardNamedValue[];
  desktopVersions: DashboardNamedValue[];
  downloadsByPlatform: DashboardNamedValue[];
};

export type AdminDashboardData = {
  rangeDays: DashboardRangeDays;
  timezone: "Asia/Shanghai";
  generatedAt: number;
  summary: AdminDashboardSummary;
  daily: DashboardDailyPoint[];
  distributions: AdminDashboardDistributions;
};
