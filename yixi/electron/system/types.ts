export type ApiResponse<T> = {
  msg: string;
  code: number;
  data: T | null;
  success: boolean;
};

export type GatewaySignConfig = {
  secret: string;
  as: string;
};

export type BootstrapConfig = {
  version: string;
  updatedAt: number;
  endpoints: Record<string, string>;
  gatewaySign?: GatewaySignConfig;
  updater?: {
    desktop?: {
      enabled: boolean;
      feedBaseUrl: string;
      checkOnStartup: boolean;
      startupDelayMs: number;
    };
  };
};

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

export type FeedbackPayload = {
  feedback_type: "bug" | "suggestion" | "account" | "other";
  description: string;
  contact?: string;
  device?: Record<string, unknown>;
};

export type RuntimeEndpoints = {
  kgServer: string;
  wyServer: string;
  kwServer: string;
  kgProxy: string;
  wyProxy: string;
  kwProxy: string;
};

export type DesktopDeviceReportRequest = {
  clientId: string;
  deviceName: string;
  hostname: string;
  osName: string;
  osVersion: string;
  platform: string;
  arch: string;
  appVersion: string;
  extras?: Record<string, unknown>;
};

export type DesktopDeviceReportResult = {
  id: string;
  locked: boolean;
  lockEndTime: number | null;
  lastActiveAt: number;
  firstSeenAt: number;
};

export type StartupServiceState = {
  localMode: boolean;
  reason: string;
  deviceId: string;
};
