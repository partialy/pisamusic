import type { PendingNetworkErrorRecord } from "../database/types";

export type FaultReportScene = "desktop_network";

export type FaultReportEnvironment = {
  platform: "desktop";
  arch: string;
  appVersion: string;
  appVersionCode: number;
  osVersion: string;
  sdkInt: number;
  brand: string;
  model: string;
  networkType: string;
};

export type FaultReportLogPayload = {
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

export type FaultReportRequest = {
  reportId: string;
  scene: FaultReportScene;
  environment: FaultReportEnvironment;
  logs: FaultReportLogPayload[];
};

export type FaultReportSubmitData = {
  reportId: string | null;
  acceptedCount: number;
  duplicateCount: number;
  receivedCount: number;
  createdAt: number;
};

export type DesktopFaultReportSubmitResult = FaultReportSubmitData & {
  remainingCount: number;
};

export type DesktopFaultReportSourceRecord = PendingNetworkErrorRecord;
