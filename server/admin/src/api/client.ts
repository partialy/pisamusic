import type { ApiResponse } from "../types/api";
import type {
  Announcement,
  AppConfigJson,
  AppConfigSectionsPayload,
  AppUpdatePayload,
  DynamicConfigItem,
  DynamicConfigPayload,
  DeviceFilter,
  DeviceInfo,
  DeviceListResponse,
  ReleaseFileInfo,
  ReleasePlatform,
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

export async function fetchDynamicConfigs(): Promise<DynamicConfigItem[]> {
  const res = await fetchWithAuth("/api/admin/dynamic-configs");
  const body = await parseJson<DynamicConfigItem[]>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function createDynamicConfig(payload: DynamicConfigPayload): Promise<DynamicConfigItem> {
  const res = await fetchWithAuth("/api/admin/dynamic-configs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = await parseJson<DynamicConfigItem>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function updateDynamicConfig(id: string, payload: DynamicConfigPayload): Promise<DynamicConfigItem> {
  const res = await fetchWithAuth(`/api/admin/dynamic-configs/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const body = await parseJson<DynamicConfigItem>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function deleteDynamicConfig(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/dynamic-configs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = await parseJson<null>(res);
  if (!res.ok || !body.success) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
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
  const body = await parseJson<{ id: string; update: AppUpdatePayload; platform: string }>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

type UploadTokenResponse = {
  uploadToken: string;
  uploadUrl: string;
  key: string;
  bucket: string;
  domain: string;
  cdnDomain: string;
  downloadUrl: string;
  expiresAt: number;
};

type QiniuUploadResponse = {
  key?: string;
  hash?: string;
  fsize?: number;
  bucket?: string;
};

async function fetchReleaseUploadToken(file: File, platform: ReleasePlatform): Promise<UploadTokenResponse> {
  const res = await fetchWithAuth("/api/admin/release-files/upload-token", {
    method: "POST",
    body: JSON.stringify({
      platform,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }),
  });
  const body = await parseJson<UploadTokenResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

async function uploadFileToQiniu(file: File, token: UploadTokenResponse): Promise<QiniuUploadResponse> {
  const formData = new FormData();
  formData.append("token", token.uploadToken);
  formData.append("key", token.key);
  formData.append("x:name", file.name);
  formData.append("file", file);
  const res = await fetch(token.uploadUrl, {
    method: "POST",
    body: formData,
  });
  const body = (await res.json().catch(() => ({}))) as QiniuUploadResponse & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `七牛上传失败：HTTP ${res.status}`);
  }
  return body;
}

async function completeReleaseUpload(
  file: File,
  platform: ReleasePlatform,
  token: UploadTokenResponse,
  uploaded: QiniuUploadResponse,
): Promise<ReleaseFileInfo> {
  const res = await fetchWithAuth("/api/admin/release-files/complete", {
    method: "POST",
    body: JSON.stringify({
      platform,
      bucket: uploaded.bucket || token.bucket,
      key: uploaded.key || token.key,
      hash: uploaded.hash || "",
      fileName: file.name,
      mimeType: file.type,
      fileSize: Number(uploaded.fsize || file.size),
    }),
  });
  const body = await parseJson<ReleaseFileInfo>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function uploadReleasePackage(file: File, platform: ReleasePlatform): Promise<ReleaseFileInfo> {
  const token = await fetchReleaseUploadToken(file, platform);
  const uploaded = await uploadFileToQiniu(file, token);
  return completeReleaseUpload(file, platform, token, uploaded);
}

export async function deleteReleasePackage(historyId: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/update-history/${encodeURIComponent(historyId)}/release-file`, {
    method: "DELETE",
  });
  const body = await parseJson<{ releaseFile: ReleaseFileInfo }>(res);
  if (!res.ok || !body.success) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
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
