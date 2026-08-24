import { randomUUID } from "node:crypto";
import os from "node:os";
import { app } from "electron";
import { getAppDatabase } from "../database";
import { submitDesktopFaultReport } from "../system/systemClient";
import { toDesktopFaultReportLog } from "./payload";
import type {
  DesktopFaultReportSubmitResult,
  FaultReportEnvironment,
  FaultReportRequest,
} from "./types";

const MAX_BATCH_SIZE = 300;

export function getDesktopFaultReportStats() {
  return getAppDatabase().getNetworkErrorFaultStats();
}

export async function submitPendingDesktopFaultReport(): Promise<DesktopFaultReportSubmitResult> {
  const database = getAppDatabase();
  const records = database.listPendingNetworkErrors(MAX_BATCH_SIZE);
  if (records.length === 0) throw new Error("暂无待上报的故障信息");

  const request: FaultReportRequest = {
    reportId: randomUUID(),
    scene: "desktop_network",
    environment: collectDesktopEnvironment(),
    logs: records.map(toDesktopFaultReportLog),
  };
  const result = await submitDesktopFaultReport(request);
  database.markNetworkErrorsUploaded(records.map((record) => record.clientLogId));
  return {
    ...result,
    remainingCount: database.getNetworkErrorFaultStats().pendingCount,
  };
}

function collectDesktopEnvironment(): FaultReportEnvironment {
  return {
    platform: "desktop",
    arch: process.arch,
    appVersion: app.getVersion(),
    appVersionCode: 0,
    osVersion: os.release(),
    sdkInt: 0,
    brand: os.type(),
    model: process.platform,
    networkType: "unknown",
  };
}
