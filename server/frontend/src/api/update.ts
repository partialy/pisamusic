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

export function trackedDownloadHref(platform: "android" | "desktop", release?: ReleaseInfo): string {
  if (!release?.available || !release.downloadUrl) return "#download";
  return downloadTriggerHref(platform);
}

/** 所有官网下载触发入口共用，安装包可用性仍由各调用方或下载接口判断。 */
export function downloadTriggerHref(platform: "android" | "desktop"): string {
  const params = new URLSearchParams(window.location.search);
  const target = new URL(`/api/config/download/${platform}`, window.location.origin);
  // 非法显式码仍要阻止服务器回退到旧 Cookie。
  if (params.has("code")) {
    const code = params.get("code") || "";
    target.searchParams.set("code", /^[A-Za-z0-9]{6}$/.test(code) && params.getAll("code").length === 1 ? code : "invalid");
  }
  return target.pathname + target.search;
}
