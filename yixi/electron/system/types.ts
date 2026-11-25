import type { Announcement } from "../../src/types/announcement";
import type { AccountAuthResult } from "../../src/types/account";
import type { DirectMessageUnreadPage } from "../../src/types/directMessage";

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

export type { Announcement };

export type AnnouncementReadResult = {
  announcementId: string;
  readAt: number;
  recorded: boolean;
};

export type AboutInfo = {
  appName: string;
  websiteLabel: string;
  websiteUrl: string;
  description: string;
  team: string;
  copyright: string;
};

export type TextContentConfig = {
  title: string;
  content: string;
  version: number;
};

export type FeedbackImagePayload = {
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer;
};

export type FeedbackPayload = {
  feedback_type: "bug" | "suggestion" | "account" | "other";
  description: string;
  contact?: string;
  device?: Record<string, unknown>;
  images?: FeedbackImagePayload[];
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
  messageToken: string;
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

export type DesktopReleaseInfo = {
  latestVersion: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
  platformLabel?: string;
  fileSizeText?: string;
  available?: boolean;
};

export type DesktopStartupAgreement = {
  version: number;
  acceptedUpToDate: boolean;
  title: string;
  content: string;
};

export type DesktopStartupResult = {
  serverTime?: number;
  bootstrap: BootstrapConfig;
  update: DesktopReleaseInfo | null;
  agreement: DesktopStartupAgreement;
  device: DesktopDeviceReportResult;
  announcements: Announcement[];
  account: {
    status: "none" | "refreshed" | "expired";
    session: AccountAuthResult | null;
  };
  unreadMessages: DirectMessageUnreadPage;
};
