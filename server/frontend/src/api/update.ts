import type { ApiResponse, AppUpdateInfo } from "../types/update";

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
