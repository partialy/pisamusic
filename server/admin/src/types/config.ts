export type AppUpdatePayload = {
  platform?: ReleasePlatform;
  latestVersion: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
  platformLabel?: string;
  fileSizeText?: string;
  available?: boolean;
  releaseFileId?: string;
};

export type ReleasePlatform = "android" | "desktop";

export type DynamicConfigType = "html" | "string" | "number" | "url";

export type DynamicConfigItem = {
  id: string;
  type: DynamicConfigType;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type DynamicConfigPayload = {
  id: string;
  type: DynamicConfigType;
  content: string;
};

export type ReleaseInfo = {
  latestVersion: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
  platformLabel: string;
  fileSizeText: string;
  available: boolean;
};

export type ReleaseConfig = Record<ReleasePlatform, ReleaseInfo>;

export type ReleaseFileInfo = {
  id: string;
  fileRecordId?: string | null;
  historyId: string | null;
  platform: ReleasePlatform;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
  status: "uploaded" | "deleted";
  createdAt: number;
  deletedAt: number | null;
  desktopUpdateAsset?: DesktopUpdateAssetInfo;
};

export type DesktopUpdateAssetType = "latest-yml" | "installer" | "blockmap";

export type DesktopUpdateAssetInfo = {
  id: string;
  fileRecordId?: string | null;
  version: string;
  platform: "win32";
  arch: "x64";
  fileType: DesktopUpdateAssetType;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: "uploaded" | "deleted";
  active: boolean;
  createdAt: number;
  deletedAt: number | null;
  releaseFile?: ReleaseFileInfo | null;
};

export type FileRecordInfo = {
  id: string;
  usageType: "release-package" | "desktop-update";
  platform: string;
  version: string;
  assetType: string;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
  status: "uploaded" | "deleted";
  referencedBy: string[];
  createdAt: number;
  deletedAt: number | null;
};

export type FileRecordListResponse = {
  items: FileRecordInfo[];
  total: number;
  offset: number;
  limit: number;
};

export type UpdateHistoryItem = {
  id: string;
  platform: ReleasePlatform;
  version: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
  releaseFileId?: string | null;
  releaseFile?: ReleaseFileInfo | null;
};

export type UpdateHistoryDeletionPreview = {
  history: UpdateHistoryItem;
  files: FileRecordInfo[];
};

export type GatewaySignConfig = {
  secret: string;
  as: string;
};

export type DesktopUpdaterConfig = {
  enabled: boolean;
  feedBaseUrl: string;
  checkOnStartup: boolean;
  startupDelayMs: number;
};

export type EmailConfig = {
  serviceUrl: string;
  provider: string;
  providers: EmailProviderConfig[];
};

export type EmailProviderConfig = {
  code: string;
  name: string;
};

export type AppConfigJson = {
  availability: {
    appAvailable: boolean;
    unavailableReason: string;
  };
  email: EmailConfig;
  bootstrap: {
    version: string;
    updatedAt: number;
    endpoints: Record<string, string>;
    gatewaySign?: GatewaySignConfig;
    updater?: {
      desktop?: DesktopUpdaterConfig;
    };
  };
  update: AppUpdatePayload;
  releases: ReleaseConfig;
  agreement: {
    title: string;
    content: string;
  };
  privacy: {
    title: string;
    content: string;
  };
  about: {
    appName: string;
    websiteLabel: string;
    websiteUrl: string;
    description: string;
    team: string;
    copyright: string;
  };
  discover: {
    url: string;
    updatedAt: number;
  };
  encryption?: {
    plaintextPaths: string[];
  };
};

export type AppConfigSectionsPayload = Partial<
  Pick<AppConfigJson, "availability" | "email" | "bootstrap" | "releases" | "agreement" | "privacy" | "about" | "discover">
>;

export const DEFAULT_PLAINTEXT_PATHS: readonly string[] = [
  "/api/health",
  "/api/config/bootstrap",
  "/api/config/check-update",
  "/api/config/get",
  "/api/config/releases",
  "/api/config/release-files/*",
  "/api/config/desktop-updates/*",
  "/api/config/download/*",
  "/api/config/discover",
  "/api/config/update-history",
  "/api/config/agreement",
  "/api/config/service-agreement",
  "/api/config/privacy-policy",
  "/api/config/about",
  "/api/config/announcements",
  "/api/analytics/site-visit",
  "/api/feedback/*",
  "/discover/*",
  "/uploads/*",
];

export type Announcement = {
  id: string;
  content: string;
  time: string;
  publisher: string;
  confirmText: string;
  showEveryTime?: boolean;
  showGotoButton: boolean;
  gotoUrl?: string;
};

export type UpdateFormDraft = {
  platform: ReleasePlatform;
  version: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
  platformLabel: string;
  fileSizeText: string;
  available: boolean;
  releaseFileId?: string;
};

export type DeviceInfo = {
  id: string;
  fingerprint: string;
  deviceKind?: "android";
  deviceName: string;
  brand: string;
  model: string;
  osVersion: string;
  sdkVersion: number;
  appVersion: string;
  appVersionCode: number;
  locked: boolean;
  lockEndTime: number | null;
  firstSeenAt: number;
  lastActiveAt: number;
  firstSeenIp: string | null;
  lastSeenIp: string | null;
  lastCountryCode: string | null;
  lastTimezone: string | null;
  lastLocale: string | null;
  extraInfo: Record<string, unknown>;
};

export type DesktopDeviceInfo = {
  id: string;
  fingerprint: string;
  deviceKind?: "desktop";
  deviceName: string;
  hostname: string;
  osName: string;
  osVersion: string;
  platform: string;
  arch: string;
  appVersion: string;
  locked: boolean;
  lockEndTime: number | null;
  firstSeenAt: number;
  lastActiveAt: number;
  firstSeenIp: string | null;
  lastSeenIp: string | null;
  extraInfo: Record<string, unknown>;
};

export type DeviceListResponse = {
  devices: DeviceInfo[];
  total: number;
  offset: number;
  limit: number;
};

export type DesktopDeviceListResponse = {
  devices: DesktopDeviceInfo[];
  total: number;
  offset: number;
  limit: number;
};

export type DeviceFilter = {
  search?: string;
  locked?: boolean;
  brand?: string;
  platform?: string;
  offset?: number;
  limit?: number;
};

export type AdminUserStats = {
  favoriteSongs: number;
  favoritePlaylists: number;
  userPlaylists: number;
};

export type AdminUserListItem = {
  id: string;
  email: string;
  username: string;
  avatar: string;
  avatarKey: string;
  avatarUrl: string;
  vipEnabled: boolean;
  vip: boolean;
  vipExpiresAt: number | null;
  syncVersion: number;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  stats: AdminUserStats;
};

export type AdminUserLibraryItem = {
  itemKey: string;
  itemId: string;
  source: string;
  name: string;
  subtitle: string;
  cover: string;
  serverUpdatedAt: number;
  clientUpdatedAt: string;
};

export type AdminUserDetail = AdminUserListItem & {
  library?: never;
};

export type AdminUserListResponse = {
  users: AdminUserListItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminUserFilter = {
  keyword?: string;
  offset?: number;
  limit?: number;
};

export type AdminUserLibraryKind = "favoriteSongs" | "favoritePlaylists" | "userPlaylists";

export type AdminUserLibraryPage = {
  items: AdminUserLibraryItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminUserUpdatePayload = {
  username: string;
  email: string;
  vipEnabled: boolean;
  vipExpiresAt: number | null;
};

export type ShareType = "song" | "playlist";

export type AdminShareSharer = {
  id: string;
  username: string;
  avatarUrl: string;
};

export type AdminShareListItem = {
  uuid: string;
  type: ShareType;
  source: string;
  sourceId: string;
  title: string;
  description: string;
  coverUrl: string;
  sharer: AdminShareSharer;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  valid: boolean;
  invalidatedAt: number | null;
};

export type AdminShareListResponse = {
  items: AdminShareListItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminShareFilter = {
  type?: ShareType;
  sharer?: string;
  valid?: "true" | "false" | "all";
  offset?: number;
  limit?: number;
};

export type FeedbackType = "bug" | "suggestion" | "account" | "other";

export type FeedbackStatus = "pending" | "processed";

export type AdminFeedbackListItem = {
  id: string;
  createdAt: string;
  feedbackType: FeedbackType;
  description: string;
  contact: string | null;
  status: FeedbackStatus;
  processedAt: string | null;
  imageCount: number;
  firstImageUrl: string | null;
};

export type AdminFeedbackDetail = AdminFeedbackListItem & {
  device: Record<string, unknown>;
  images: string[];
};

export type AdminFeedbackListResponse = {
  items: AdminFeedbackListItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminFeedbackFilter = {
  status?: FeedbackStatus;
  type?: FeedbackType;
  keyword?: string;
  offset?: number;
  limit?: number;
};

export type WebsiteRecordType = "visit" | "download";

export type AdminWebsiteVisitListItem = {
  id: string;
  visitDay: string;
  path: string;
  referrer: string;
  ipAddress: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  createdAt: number;
};

export type AdminWebsiteVisitDetail = AdminWebsiteVisitListItem & {
  visitorHash: string;
  userAgent: string;
  timezone: string;
};

export type AdminWebsiteDownloadListItem = {
  id: string;
  downloadDay: string;
  platform: "android" | "desktop";
  version: string;
  fileRecordId: string | null;
  ipAddress: string;
  createdAt: number;
};

export type AdminWebsiteDownloadDetail = AdminWebsiteDownloadListItem & {
  referrer: string;
  userAgent: string;
};

export type AdminWebsiteVisitListResponse = {
  items: AdminWebsiteVisitListItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminWebsiteDownloadListResponse = {
  items: AdminWebsiteDownloadListItem[];
  total: number;
  offset: number;
  limit: number;
};

export type FaultReportStatus = "pending" | "processed";
export type FaultReportScene = "play_url" | "desktop_network";
export type FaultReportPlatform = "android" | "desktop";

export type FaultReportLog = {
  clientLogId: string;
  occurredAt: number;
  scene: FaultReportScene;
  failureType: string;
  methodName: string;
  requestMethod: string;
  requestUrl: string;
  requestParamsJson: string;
  nonceId: string;
  responseCode: number | null;
  responseBody: string;
  resolvedUrl: string;
  errorType: string;
  errorMessage: string;
  stackTrace: string;
  songSource: string;
  songId: string;
  quality: string;
};

export type AdminFaultReportListItem = {
  id: string;
  userId: string | null;
  scene: FaultReportScene;
  platform: FaultReportPlatform;
  arch: string;
  appVersion: string;
  appVersionCode: number;
  osVersion: string;
  sdkInt: number;
  brand: string;
  model: string;
  networkType: string;
  logCount: number;
  status: FaultReportStatus;
  createdAt: number;
  processedAt: number | null;
};

export type AdminFaultReportDetail = AdminFaultReportListItem & { logs: FaultReportLog[] };
export type AdminFaultReportListResponse = { items: AdminFaultReportListItem[]; total: number; offset: number; limit: number };
export type AdminFaultReportFilter = {
  status?: FaultReportStatus;
  scene?: FaultReportScene;
  keyword?: string;
  offset?: number;
  limit?: number;
};

export type PisaAdminExport = AppConfigJson & {
  announcements: Announcement[];
  updateHistory: UpdateHistoryItem[];
};
