import type { AppUpdatePayload, UpdateFormDraft, UpdateHistoryItem } from "../types/config";

export function historyItemToDraft(item: UpdateHistoryItem): UpdateFormDraft {
  return {
    version: item.version,
    updateTime: item.updateTime,
    forceUpdate: item.forceUpdate,
    downloadUrl: item.downloadUrl,
    officialUrl: item.officialUrl,
    updateContent: item.updateContent,
  };
}

export function appUpdateToDraft(u: AppUpdatePayload): UpdateFormDraft {
  return {
    version: u.latestVersion,
    updateTime: u.updateTime,
    forceUpdate: u.forceUpdate,
    downloadUrl: u.downloadUrl,
    officialUrl: u.officialUrl,
    updateContent: u.updateContent,
  };
}

export function draftToPayload(d: UpdateFormDraft): AppUpdatePayload {
  return {
    latestVersion: d.version.trim(),
    updateTime: d.updateTime.trim(),
    forceUpdate: d.forceUpdate,
    downloadUrl: d.downloadUrl.trim(),
    officialUrl: d.officialUrl.trim(),
    updateContent: d.updateContent.trim(),
  };
}
