import type { FileRecordInfo } from "../types/config";

export function fileUsageText(file: FileRecordInfo): string {
  if (file.usageType === "app-share-icon") return "App分享图标";
  if (file.usageType === "desktop-update") return "PC 自动更新文件";
  if (file.usageType === "cloud-music") return "网盘音乐";
  if (file.usageType === "announcement-image") return "公告图片";
  return "发布安装包";
}

export function fileAssetTypeText(file: FileRecordInfo): string {
  if (file.assetType === "image") return "图片";
  if (file.assetType === "installer") return "安装包";
  if (file.assetType === "latest-yml") return "latest.yml";
  if (file.assetType === "blockmap") return "blockmap";
  if (file.assetType === "audio") return "音频";
  if (file.assetType === "cover-uploaded") return "手动封面";
  if (file.assetType === "cover-extracted") return "内嵌封面";
  if (file.assetType === "lyrics") return "歌词";
  return file.assetType || "-";
}
