import { fetchWithAuth, parseJson, uploadFileToQiniu, type UploadTokenResponse, type UploadProgressHandler } from "./client";

export type AppShareDraft = {
  appName: string;
  versionOverride: string;
  iconFileId: string | null;
  description: string;
  qrCodeText: string;
  copyTemplate: string;
};

export type AppShareConfig = AppShareDraft & {
  version: string;
  iconUrl: string;
  copyText: string;
  updatedAt: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(`/api/admin/app-share${path}`, init);
  const body = await parseJson<T>(res);
  if (!res.ok || !body.success || body.data == null) throw new Error(body.msg || `HTTP ${res.status}`);
  return body.data;
}

export function fetchAppShare(signal?: AbortSignal): Promise<AppShareConfig> {
  return request("", { signal });
}

export function saveAppShare(draft: AppShareDraft): Promise<AppShareConfig> {
  return request("", { method: "PUT", body: JSON.stringify(draft) });
}

export async function uploadAppShareIcon(file: File, onProgress?: UploadProgressHandler): Promise<{ fileId: string; url: string }> {
  const token = await request<UploadTokenResponse>("/icon/upload-token", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
  });
  await uploadFileToQiniu(file, token, onProgress);
  return request("/icon/complete", { method: "POST", body: JSON.stringify({ key: token.key, bucket: token.bucket }) });
}
