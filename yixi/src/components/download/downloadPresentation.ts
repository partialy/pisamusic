import type { DownloadTaskState } from "@/types/download";
import { getQualityOption } from "@/utils/musicQuality";
export const statusLabel = (status: DownloadTaskState) => ({ queued: "等待中", preparing: "准备中", running: "下载中", pausing: "正在暂停", paused: "已暂停", processing: "后处理中", completed: "已完成", failed: "失败", cancelled: "已取消" })[status];
export const qualityLabel = (key: string) => getQualityOption(key)?.shortLabel || key || "自动";
export const metadataLabel = (status?: string) => ({ embedded: "已嵌入", sidecar: "侧车补充", failed: "写入失败" })[status || ""] || "尚未生成";
export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 4);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${["B", "KB", "MB", "GB", "TB"][index]}`;
}
export function formatDate(value?: string) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "未知" : date.toLocaleString();
}
export function sourceLabel(source: string) { return ({kg: "酷狗", wy: "网易云", kw: "酷我", qq: "QQ", local: "本地"})[source] || source; }
