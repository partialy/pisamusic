import type { ApiResponse } from "../types/api";
import type {
  Announcement,
  AppConfigJson,
  AppConfigSectionsPayload,
  AppUpdatePayload,
  DeviceFilter,
  DeviceInfo,
  DeviceListResponse,
  UpdateHistoryItem,
} from "../types/config";
import { clearStoredToken, getStoredToken } from "../auth/token";
import { encryptedFetch } from "./crypto";

const JSON_HEADERS: Record<string, string> = { "Content-Type": "application/json" };

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function authHeaders(): Record<string, string> {
  const t = getStoredToken();
  const h = { ...JSON_HEADERS };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function parseJson<T>(res: Response): Promise<ApiResponse<T>> {
  return (await res.json()) as ApiResponse<T>;
}

async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const res = await encryptedFetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string>) },
  });
  if (res.status === 401 && !url.includes("/api/admin/login")) {
    clearStoredToken();
    unauthorizedHandler?.();
  }
  return res;
}

export async function login(username: string, password: string): Promise<{ token: string; username: string }> {
  const res = await encryptedFetch("/api/admin/login", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, password }),
  });
  const body = await parseJson<{ token: string; username: string }>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAppConfig(): Promise<AppConfigJson> {
  const res = await fetchWithAuth("/api/admin/app-config");
  const body = await parseJson<AppConfigJson>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await fetchWithAuth("/api/admin/announcements");
  const body = await parseJson<Announcement[]>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function saveAnnouncement(payload: Announcement): Promise<Announcement> {
  const res = await fetchWithAuth(payload.id ? `/api/admin/announcements/${encodeURIComponent(payload.id)}` : "/api/admin/announcements", {
    method: payload.id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
  const body = await parseJson<Announcement>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/announcements/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = await parseJson<null>(res);
  if (!res.ok || !body.success) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
}

export async function fetchUpdateHistory(): Promise<UpdateHistoryItem[]> {
  const res = await fetchWithAuth("/api/admin/update-history");
  const body = await parseJson<UpdateHistoryItem[]>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function publishUpdate(payload: AppUpdatePayload): Promise<{ id: string; update: AppUpdatePayload }> {
  const res = await fetchWithAuth("/api/admin/publish-update", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ id: string; update: AppUpdatePayload }>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchEncryptionConfig(): Promise<{ plaintextPaths: string[] }> {
  const res = await fetchWithAuth("/api/admin/encryption-config");
  const body = await parseJson<{ plaintextPaths: string[] }>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function saveEncryptionConfig(plaintextPaths: string[]): Promise<{ plaintextPaths: string[] }> {
  const res = await fetchWithAuth("/api/admin/encryption-config", {
    method: "POST",
    body: JSON.stringify({ plaintextPaths }),
  });
  const body = await parseJson<{ plaintextPaths: string[] }>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function saveAppConfigSections(payload: AppConfigSectionsPayload): Promise<AppConfigJson> {
  const res = await fetchWithAuth("/api/admin/app-config-sections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = await parseJson<AppConfigJson>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetchWithAuth("/api/admin/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const body = await parseJson<{ updated: boolean }>(res);
  if (!res.ok || !body.success) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
}

export async function fetchDevices(filter: DeviceFilter): Promise<DeviceListResponse> {
  const params = new URLSearchParams();
  if (filter.search) params.set("search", filter.search);
  if (filter.locked !== undefined) params.set("locked", String(filter.locked));
  if (filter.brand) params.set("brand", filter.brand);
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const qs = params.toString();
  const url = `/api/admin/device/list${qs ? `?${qs}` : ""}`;
  const res = await fetchWithAuth(url);
  const body = await parseJson<DeviceListResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchDeviceDetail(id: string): Promise<DeviceInfo> {
  const res = await fetchWithAuth(`/api/admin/device/${id}`);
  const body = await parseJson<DeviceInfo>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function lockDevice(id: string, locked: boolean, lockEndTime?: number | null): Promise<DeviceInfo> {
  const res = await fetchWithAuth(`/api/admin/device/${id}/lock`, {
    method: "POST",
    body: JSON.stringify({ locked, lockEndTime: lockEndTime ?? null }),
  });
  const body = await parseJson<DeviceInfo>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function deleteDevice(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/device/${id}`, {
    method: "DELETE",
  });
  const body = await parseJson<null>(res);
  if (!res.ok || !body.success) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
}
