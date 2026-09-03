import type { ApiResponse } from "../types/api";
import type {
  AdminFeedbackDetail,
  AdminFeedbackFilter,
  AdminFeedbackListResponse,
  AdminDirectMessageItem,
  AdminDirectMessagePage,
  AdminWebsiteDownloadDetail,
  AdminWebsiteDownloadListResponse,
  AdminWebsiteVisitDetail,
  AdminWebsiteVisitListResponse,
  AdminFaultReportDetail,
  AdminFaultReportFilter,
  AdminFaultReportListResponse,
  AdminShareFilter,
  AdminShareListItem,
  AdminShareListResponse,
  Announcement,
  AnnouncementReadPage,
  AppConfigJson,
  AppConfigSectionsPayload,
  AppUpdatePayload,
  AdminUserDetail,
  AdminUserFilter,
  AdminUserLibraryKind,
  AdminUserLibraryPage,
  AdminUserListItem,
  AdminUserListResponse,
  AdminUserUpdatePayload,
  DesktopUpdateAssetInfo,
  DirectMessageTargetKind,
  DynamicConfigItem,
  DynamicConfigPayload,
  FileRecordInfo,
  FileRecordListResponse,
  FeedbackStatus,
  FaultReportStatus,
  DeviceFilter,
  DeviceInfo,
  DeviceListResponse,
  DesktopDeviceInfo,
  DesktopDeviceListResponse,
  ReleaseFileInfo,
  ReleasePlatform,
  UpdateHistoryDeletionPreview,
  UpdateHistoryItem,
  VerificationCodeFilter,
  VerificationCodeListResponse,
} from "../types/config";
import type { RuntimeConfigChange, RuntimeConfigResponse } from "../types/runtimeConfig";
import type { AdminDashboardData, DashboardRangeDays } from "../types/dashboard";
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

export async function parseJson<T>(res: Response): Promise<ApiResponse<T>> {
  return (await res.json()) as ApiResponse<T>;
}

export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
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

export async function fetchAnnouncementReads(
  id: string,
  offset = 0,
  limit = 20,
): Promise<AnnouncementReadPage> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const res = await fetchWithAuth(`/api/admin/announcements/${encodeURIComponent(id)}/reads?${params.toString()}`);
  const body = await parseJson<AnnouncementReadPage>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export type AnnouncementImageUploadResult = {
  fileId: string;
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
};

export async function uploadAnnouncementImage(
  file: File,
  announcementId: string,
  onProgress?: UploadProgressHandler,
): Promise<AnnouncementImageUploadResult> {
  const tokenRes = await fetchWithAuth("/api/admin/announcements/images/upload-token", {
    method: "POST",
    body: JSON.stringify({
      announcementId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }),
  });
  const tokenBody = await parseJson<UploadTokenResponse>(tokenRes);
  if (!tokenRes.ok || !tokenBody.success || tokenBody.data == null) {
    throw new Error(tokenBody.msg || `HTTP ${tokenRes.status}`);
  }
  const token = tokenBody.data;
  const uploaded = await uploadFileToQiniu(file, token, onProgress);
  const completeRes = await fetchWithAuth("/api/admin/announcements/images/complete", {
    method: "POST",
    body: JSON.stringify({
      announcementId,
      bucket: uploaded.bucket || token.bucket,
      key: uploaded.key || token.key,
      hash: uploaded.hash || "",
      fileName: file.name,
      mimeType: file.type,
      fileSize: Number(uploaded.fsize || file.size),
    }),
  });
  const completeBody = await parseJson<AnnouncementImageUploadResult>(completeRes);
  if (!completeRes.ok || !completeBody.success || completeBody.data == null) {
    throw new Error(completeBody.msg || `HTTP ${completeRes.status}`);
  }
  return completeBody.data;
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

export async function updatePublishedUpdate(historyId: string, payload: AppUpdatePayload): Promise<UpdateHistoryItem> {
  const res = await fetchWithAuth(`/api/admin/update-history/${encodeURIComponent(historyId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ id: string; update: AppUpdatePayload; platform: string; history: UpdateHistoryItem }>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data.history;
}

export type UploadTokenResponse = {
  uploadToken: string;
  uploadUrl: string;
  key: string;
  bucket: string;
  domain: string;
  cdnDomain: string;
  downloadUrl: string;
  expiresAt: number;
};

export type QiniuUploadResponse = {
  key?: string;
  hash?: string;
  fsize?: number;
  bucket?: string;
};

export type UploadProgressHandler = (progress: number) => void;

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

export function uploadFileToQiniu(file: File, token: UploadTokenResponse, onProgress?: UploadProgressHandler): Promise<QiniuUploadResponse> {
  const formData = new FormData();
  formData.append("token", token.uploadToken);
  formData.append("key", token.key);
  formData.append("x:name", file.name);
  formData.append("file", file);
  onProgress?.(0);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", token.uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const progress = Math.min(99, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      onProgress?.(progress);
    };

    xhr.onload = () => {
      let body: QiniuUploadResponse & { error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText || "{}") as QiniuUploadResponse & { error?: string };
      } catch {
        body = {};
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(body.error || `七牛上传失败：HTTP ${xhr.status}`));
        return;
      }
      onProgress?.(100);
      resolve(body);
    };

    xhr.onerror = () => reject(new Error("七牛上传网络异常"));
    xhr.onabort = () => reject(new Error("七牛上传已取消"));
    xhr.send(formData);
  });
}

async function completeReleaseUpload(
  file: File,
  platform: ReleasePlatform,
  version: string | undefined,
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
      version,
    }),
  });
  const body = await parseJson<ReleaseFileInfo>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function uploadReleasePackage(file: File, platform: ReleasePlatform, version?: string, onProgress?: UploadProgressHandler): Promise<ReleaseFileInfo> {
  const token = await fetchReleaseUploadToken(file, platform);
  const uploaded = await uploadFileToQiniu(file, token, onProgress);
  return completeReleaseUpload(file, platform, version, token, uploaded);
}

async function fetchDesktopUpdateUploadToken(file: File, version: string): Promise<UploadTokenResponse> {
  const res = await fetchWithAuth("/api/admin/desktop-updates/upload-token", {
    method: "POST",
    body: JSON.stringify({
      version,
      platform: "win32",
      arch: "x64",
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

async function completeDesktopUpdateUpload(
  file: File,
  version: string,
  token: UploadTokenResponse,
  uploaded: QiniuUploadResponse,
): Promise<DesktopUpdateAssetInfo> {
  const res = await fetchWithAuth("/api/admin/desktop-updates/complete", {
    method: "POST",
    body: JSON.stringify({
      version,
      platform: "win32",
      arch: "x64",
      bucket: uploaded.bucket || token.bucket,
      key: uploaded.key || token.key,
      hash: uploaded.hash || "",
      fileName: file.name,
      mimeType: file.type,
      fileSize: Number(uploaded.fsize || file.size),
    }),
  });
  const body = await parseJson<DesktopUpdateAssetInfo>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function uploadDesktopUpdateAsset(file: File, version: string, onProgress?: UploadProgressHandler): Promise<DesktopUpdateAssetInfo> {
  const token = await fetchDesktopUpdateUploadToken(file, version);
  const uploaded = await uploadFileToQiniu(file, token, onProgress);
  return completeDesktopUpdateUpload(file, version, token, uploaded);
}

export async function activateDesktopUpdate(version: string): Promise<DesktopUpdateAssetInfo[]> {
  const res = await fetchWithAuth("/api/admin/desktop-updates/activate", {
    method: "POST",
    body: JSON.stringify({ version, platform: "win32", arch: "x64" }),
  });
  const body = await parseJson<{ assets: DesktopUpdateAssetInfo[] }>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data.assets;
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

export async function fetchUpdateHistoryDeletePreview(historyId: string): Promise<UpdateHistoryDeletionPreview> {
  const res = await fetchWithAuth(`/api/admin/update-history/${encodeURIComponent(historyId)}/delete-preview`);
  const body = await parseJson<UpdateHistoryDeletionPreview>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function deleteUpdateHistory(historyId: string): Promise<{ id: string; deletedFiles: FileRecordInfo[] }> {
  const res = await fetchWithAuth(`/api/admin/update-history/${encodeURIComponent(historyId)}`, {
    method: "DELETE",
  });
  const body = await parseJson<{ id: string; deletedFiles: FileRecordInfo[] }>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchFileRecords(params: {
  status?: "uploaded" | "deleted" | "pending" | "all";
  usageType?: "release-package" | "desktop-update" | "cloud-music" | "all";
  platform?: string;
  version?: string;
  keyword?: string;
  offset?: number;
  limit?: number;
}): Promise<FileRecordListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const res = await fetchWithAuth(`/api/admin/files?${query.toString()}`);
  const body = await parseJson<FileRecordListResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function deleteFileRecord(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/files/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = await parseJson<{ file: unknown }>(res);
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

export async function fetchDesktopDevices(filter: DeviceFilter): Promise<DesktopDeviceListResponse> {
  const params = new URLSearchParams();
  if (filter.search) params.set("search", filter.search);
  if (filter.locked !== undefined) params.set("locked", String(filter.locked));
  if (filter.platform) params.set("platform", filter.platform);
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const qs = params.toString();
  const url = `/api/admin/desktop-device/list${qs ? `?${qs}` : ""}`;
  const res = await fetchWithAuth(url);
  const body = await parseJson<DesktopDeviceListResponse>(res);
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

export async function fetchDesktopDeviceDetail(id: string): Promise<DesktopDeviceInfo> {
  const res = await fetchWithAuth(`/api/admin/desktop-device/${id}`);
  const body = await parseJson<DesktopDeviceInfo>(res);
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

export async function lockDesktopDevice(id: string, locked: boolean, lockEndTime?: number | null): Promise<DesktopDeviceInfo> {
  const res = await fetchWithAuth(`/api/admin/desktop-device/${id}/lock`, {
    method: "POST",
    body: JSON.stringify({ locked, lockEndTime: lockEndTime ?? null }),
  });
  const body = await parseJson<DesktopDeviceInfo>(res);
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

export async function deleteDesktopDevice(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/desktop-device/${id}`, {
    method: "DELETE",
  });
  const body = await parseJson<null>(res);
  if (!res.ok || !body.success) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
}

export async function sendDirectMessage(input: {
  targetKind: DirectMessageTargetKind;
  targetId: string;
  content: string;
}): Promise<AdminDirectMessageItem> {
  const res = await fetchWithAuth("/api/admin/messages", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body = await parseJson<AdminDirectMessageItem>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchDirectMessages(input: {
  targetKind: DirectMessageTargetKind;
  targetId: string;
  offset: number;
  limit: number;
}): Promise<AdminDirectMessagePage> {
  const params = new URLSearchParams({
    targetKind: input.targetKind,
    targetId: input.targetId,
    offset: String(input.offset),
    limit: String(input.limit),
  });
  const res = await fetchWithAuth(`/api/admin/messages?${params.toString()}`);
  const body = await parseJson<AdminDirectMessagePage>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function deleteDirectMessage(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/messages/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = await parseJson<{ id: string; deleted: boolean }>(res);
  if (!res.ok || !body.success || !body.data?.deleted) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
}

export async function fetchAdminUsers(filter: AdminUserFilter): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();
  if (filter.keyword) params.set("keyword", filter.keyword);
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const qs = params.toString();
  const res = await fetchWithAuth(`/api/admin/users${qs ? `?${qs}` : ""}`);
  const body = await parseJson<AdminUserListResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminUserDetail(id: string): Promise<AdminUserDetail> {
  const res = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(id)}`);
  const body = await parseJson<AdminUserDetail>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminUserLibrary(
  id: string,
  kind: AdminUserLibraryKind,
  offset = 0,
  limit = 30,
): Promise<AdminUserLibraryPage> {
  const params = new URLSearchParams({ kind, offset: String(offset), limit: String(limit) });
  const res = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(id)}/library?${params.toString()}`);
  const body = await parseJson<AdminUserLibraryPage>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function updateAdminUser(id: string, payload: AdminUserUpdatePayload): Promise<AdminUserListItem> {
  const res = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const body = await parseJson<AdminUserListItem>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function deleteAdminUser(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = await parseJson<null>(res);
  if (!res.ok || !body.success) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
}

export async function fetchAdminFeedback(filter: AdminFeedbackFilter): Promise<AdminFeedbackListResponse> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.type) params.set("type", filter.type);
  if (filter.keyword) params.set("keyword", filter.keyword);
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const query = params.toString();
  const res = await fetchWithAuth(`/api/admin/feedback${query ? `?${query}` : ""}`);
  const body = await parseJson<AdminFeedbackListResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminFeedbackDetail(id: string): Promise<AdminFeedbackDetail> {
  const res = await fetchWithAuth(`/api/admin/feedback/${encodeURIComponent(id)}`);
  const body = await parseJson<AdminFeedbackDetail>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminWebsiteVisitRecords(
  offset: number,
  limit: number,
): Promise<AdminWebsiteVisitListResponse> {
  const params = new URLSearchParams({ type: "visit", offset: String(offset), limit: String(limit) });
  const res = await fetchWithAuth(`/api/admin/website-records?${params.toString()}`);
  const body = await parseJson<AdminWebsiteVisitListResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminWebsiteDownloadRecords(
  offset: number,
  limit: number,
): Promise<AdminWebsiteDownloadListResponse> {
  const params = new URLSearchParams({ type: "download", offset: String(offset), limit: String(limit) });
  const res = await fetchWithAuth(`/api/admin/website-records?${params.toString()}`);
  const body = await parseJson<AdminWebsiteDownloadListResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminWebsiteVisitDetail(id: string): Promise<AdminWebsiteVisitDetail> {
  const res = await fetchWithAuth(`/api/admin/website-records/visit/${encodeURIComponent(id)}`);
  const body = await parseJson<AdminWebsiteVisitDetail>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminWebsiteDownloadDetail(id: string): Promise<AdminWebsiteDownloadDetail> {
  const res = await fetchWithAuth(`/api/admin/website-records/download/${encodeURIComponent(id)}`);
  const body = await parseJson<AdminWebsiteDownloadDetail>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function updateAdminFeedbackStatus(id: string, status: FeedbackStatus): Promise<AdminFeedbackDetail> {
  const res = await fetchWithAuth(`/api/admin/feedback/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  const body = await parseJson<AdminFeedbackDetail>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminFaultReports(filter: AdminFaultReportFilter): Promise<AdminFaultReportListResponse> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.scene) params.set("scene", filter.scene);
  if (filter.keyword) params.set("keyword", filter.keyword);
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const query = params.toString();
  const res = await fetchWithAuth(`/api/admin/fault-reports${query ? `?${query}` : ""}`);
  const body = await parseJson<AdminFaultReportListResponse>(res);
  if (!res.ok || !body.success || body.data == null) throw new Error(body.msg || `HTTP ${res.status}`);
  return body.data;
}

export async function fetchAdminFaultReportDetail(id: string): Promise<AdminFaultReportDetail> {
  const res = await fetchWithAuth(`/api/admin/fault-reports/${encodeURIComponent(id)}`);
  const body = await parseJson<AdminFaultReportDetail>(res);
  if (!res.ok || !body.success || body.data == null) throw new Error(body.msg || `HTTP ${res.status}`);
  return body.data;
}

export async function updateAdminFaultReportStatus(id: string, status: FaultReportStatus): Promise<AdminFaultReportDetail> {
  const res = await fetchWithAuth(`/api/admin/fault-reports/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  const body = await parseJson<AdminFaultReportDetail>(res);
  if (!res.ok || !body.success || body.data == null) throw new Error(body.msg || `HTTP ${res.status}`);
  return body.data;
}

export async function deleteAdminFaultReport(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/fault-reports/${encodeURIComponent(id)}`, { method: "DELETE" });
  const body = await parseJson<null>(res);
  if (!res.ok || !body.success) throw new Error(body.msg || `HTTP ${res.status}`);
}

export async function fetchAdminShares(filter: AdminShareFilter): Promise<AdminShareListResponse> {
  const params = new URLSearchParams();
  if (filter.type) params.set("type", filter.type);
  if (filter.sharer) params.set("sharer", filter.sharer);
  if (filter.valid) params.set("valid", filter.valid);
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const query = params.toString();
  const res = await fetchWithAuth(`/api/admin/shares${query ? `?${query}` : ""}`);
  const body = await parseJson<AdminShareListResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function invalidateAdminShare(uuid: string): Promise<AdminShareListItem> {
  const res = await fetchWithAuth(`/api/admin/shares/${encodeURIComponent(uuid)}/invalid`, {
    method: "PATCH",
  });
  const body = await parseJson<AdminShareListItem>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminDashboard(
  days: DashboardRangeDays,
  signal?: AbortSignal,
): Promise<AdminDashboardData> {
  const res = await fetchWithAuth(`/api/admin/dashboard?days=${days}`, { signal });
  const body = await parseJson<AdminDashboardData>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchVerificationCodes(filter: VerificationCodeFilter): Promise<VerificationCodeListResponse> {
  const params = new URLSearchParams();
  if (filter.channel && filter.channel !== "all") params.set("channel", filter.channel);
  if (filter.purpose && filter.purpose !== "all") params.set("purpose", filter.purpose);
  if (filter.status && filter.status !== "all") params.set("status", filter.status);
  if (filter.keyword) params.set("keyword", filter.keyword);
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const query = params.toString();
  const res = await fetchWithAuth(`/api/admin/verification-codes${query ? `?${query}` : ""}`);
  const body = await parseJson<VerificationCodeListResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function deleteVerificationCode(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/verification-codes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = await parseJson<{ deleted: boolean }>(res);
  if (!res.ok || !body.success) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
}

export async function fetchRuntimeConfig(): Promise<RuntimeConfigResponse> {
  const res = await fetchWithAuth("/api/admin/runtime-config");
  const body = await parseJson<RuntimeConfigResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function updateRuntimeConfig(changes: RuntimeConfigChange[]): Promise<RuntimeConfigResponse> {
  const res = await fetchWithAuth("/api/admin/runtime-config", {
    method: "PATCH",
    body: JSON.stringify({ changes }),
  });
  const body = await parseJson<RuntimeConfigResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}
