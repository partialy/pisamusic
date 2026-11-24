import {
  fetchWithAuth,
  parseJson,
  uploadFileToQiniu,
  type UploadProgressHandler,
  type UploadTokenResponse,
} from "./client";
import type { SidebarMenuConfig } from "../types/sidebarMenu";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(`/api/admin/sidebar-menu${path}`, init);
  const body = await parseJson<T>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export function fetchSidebarMenu(signal?: AbortSignal): Promise<SidebarMenuConfig> {
  return request("", { signal });
}

export function saveSidebarMenu(
  payload: Omit<SidebarMenuConfig, "updatedAt">,
): Promise<SidebarMenuConfig> {
  return request("", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function uploadSidebarMenuIcon(
  file: File,
  onProgress?: UploadProgressHandler,
): Promise<{ fileId: string; url: string }> {
  const token = await request<UploadTokenResponse>("/icon/upload-token", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }),
  });
  await uploadFileToQiniu(file, token, onProgress);
  return request("/icon/complete", {
    method: "POST",
    body: JSON.stringify({ key: token.key, bucket: token.bucket }),
  });
}
