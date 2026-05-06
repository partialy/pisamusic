export type AppUpdatePayload = {
  latestVersion: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
};

export type UpdateHistoryItem = {
  id: string;
  version: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
};

export type GatewaySignConfig = {
  secret: string;
  as: string;
};

export type AppConfigJson = {
  availability: {
    appAvailable: boolean;
    unavailableReason: string;
  };
  bootstrap: {
    version: string;
    updatedAt: number;
    endpoints: Record<string, string>;
    gatewaySign?: GatewaySignConfig;
  };
  update: AppUpdatePayload;
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

export type AppConfigSectionsPayload = Partial<Pick<AppConfigJson, "availability" | "bootstrap" | "agreement" | "privacy" | "about" | "discover">>;

export const DEFAULT_PLAINTEXT_PATHS: readonly string[] = [
  "/api/health",
  "/api/config/bootstrap",
  "/api/config/check-update",
  "/api/config/discover",
  "/api/config/update-history",
  "/api/config/agreement",
  "/api/config/service-agreement",
  "/api/config/privacy-policy",
  "/api/config/about",
  "/api/config/announcements",
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
  version: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
};

export type DeviceInfo = {
  id: string;
  fingerprint: string;
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

export type DeviceListResponse = {
  devices: DeviceInfo[];
  total: number;
  offset: number;
  limit: number;
};

export type DeviceFilter = {
  search?: string;
  locked?: boolean;
  brand?: string;
  offset?: number;
  limit?: number;
};

export type PisaAdminExport = AppConfigJson & {
  announcements: Announcement[];
  updateHistory: UpdateHistoryItem[];
};
