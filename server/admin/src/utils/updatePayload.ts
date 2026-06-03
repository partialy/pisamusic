import type { AppUpdatePayload, UpdateFormDraft, UpdateHistoryItem } from "../types/config";

export function historyItemToDraft(item: UpdateHistoryItem): UpdateFormDraft {
  return {
    platform: item.platform ?? "android",
    version: item.version,
    updateTime: item.updateTime,
    forceUpdate: item.forceUpdate,
    downloadUrl: item.downloadUrl,
    officialUrl: item.officialUrl,
    updateContent: item.updateContent,
    platformLabel: item.platform === "desktop" ? "PC 版" : "Android",
    fileSizeText: "",
    available: Boolean(item.downloadUrl),
    releaseFileId: item.releaseFileId ?? undefined,
  };
}

export function appUpdateToDraft(u: AppUpdatePayload): UpdateFormDraft {
  return {
    platform: u.platform ?? "android",
    version: u.latestVersion,
    updateTime: u.updateTime,
    forceUpdate: u.forceUpdate,
    downloadUrl: u.downloadUrl,
    officialUrl: u.officialUrl,
    updateContent: u.updateContent,
    platformLabel: u.platformLabel ?? (u.platform === "desktop" ? "PC 版" : "Android"),
    fileSizeText: u.fileSizeText ?? "",
    available: u.available ?? Boolean(u.downloadUrl),
    releaseFileId: u.releaseFileId,
  };
}

export function draftToPayload(d: UpdateFormDraft): AppUpdatePayload {
  return {
    platform: d.platform,
    latestVersion: d.version.trim(),
    updateTime: d.updateTime.trim(),
    forceUpdate: d.forceUpdate,
    downloadUrl: d.downloadUrl.trim(),
    officialUrl: d.officialUrl.trim(),
    updateContent: d.updateContent.trim(),
    platformLabel: d.platformLabel.trim(),
    fileSizeText: d.fileSizeText.trim(),
    available: d.available,
    releaseFileId: d.releaseFileId,
  };
}
