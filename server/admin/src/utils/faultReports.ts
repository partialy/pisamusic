import type { FaultReportScene, FaultReportStatus } from "../types/config";

export const FAULT_REPORT_SCENE_LABELS: Record<FaultReportScene, string> = { play_url: "获取播放地址" };
export const FAULT_REPORT_STATUS_LABELS: Record<FaultReportStatus, string> = { pending: "待处理", processed: "已处理" };

export function formatFaultReportTime(value: number | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
