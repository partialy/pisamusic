import type { FeedbackType } from "../types/config";

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "异常/报错",
  suggestion: "功能建议",
  account: "账号相关",
  other: "其他问题",
};

export function formatFeedbackTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}
