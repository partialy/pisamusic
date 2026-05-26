import type { ApiResponse, AppUpdateInfo, ReleaseConfig, ReleaseInfo } from "../types/update";

export async function fetchLatestUpdate(): Promise<AppUpdateInfo> {
  const res = await fetch("/api/config/check-update", {
    headers: { Accept: "application/json" },
  });
  const body = (await res.json()) as ApiResponse<AppUpdateInfo>;

  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }

  return body.data;
}

function releaseFromUpdate(update: AppUpdateInfo): ReleaseInfo {
  return {
    ...update,
    platformLabel: "Android",
    fileSizeText: "",
    available: Boolean(update.downloadUrl),
  };
}

function unavailableDesktopRelease(): ReleaseInfo {
  return {
    latestVersion: "即将开放",
    updateTime: "",
    forceUpdate: false,
    downloadUrl: "",
    officialUrl: "https://pisamusic.partialy.cn",
    updateContent: "PC 版正在准备中。",
    platformLabel: "PC 版",
    fileSizeText: "",
    available: false,
  };
}

export async function fetchReleaseConfig(): Promise<ReleaseConfig> {
  try {
    const res = await fetch("/api/config/releases", {
      headers: { Accept: "application/json" },
    });
    const body = (await res.json()) as ApiResponse<ReleaseConfig>;

    if (!res.ok || !body.success || body.data == null) {
      throw new Error(body.msg || `HTTP ${res.status}`);
    }

    return body.data;
  } catch {
    const android = await fetchLatestUpdate();
    return {
      android: releaseFromUpdate(android),
      desktop: unavailableDesktopRelease(),
    };
  }
}
