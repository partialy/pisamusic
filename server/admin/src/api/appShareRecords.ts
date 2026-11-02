import { fetchWithAuth, parseJson } from "./client";
import type { ShareDetail, ShareFilter, ShareRecordPage } from "../types/appShareRecords";

function query(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(`/api/admin/app-share-records${path}`, init);
  const body = await parseJson<T>(response);
  if (!response.ok || !body.success || body.data == null) throw new Error(body.msg || `HTTP ${response.status}`);
  return body.data;
}
export function fetchShareRecords(filter: ShareFilter, offset: number, signal?: AbortSignal) {
  return request<ShareRecordPage>(`?${query({ ...filter, offset, limit: 20 })}`, { signal });
}
export function fetchShareDetail(id: string, visitOffset: number, downloadOffset: number, signal?: AbortSignal) {
  return request<ShareDetail>(`/${encodeURIComponent(id)}?${query({ visitOffset, downloadOffset, limit: 20 })}`, { signal });
}
export function invalidateShareRecord(id: string) {
  return request(`/${encodeURIComponent(id)}/invalid`, { method: "PATCH" });
}
export async function exportShareRecords(filter: ShareFilter): Promise<void> {
  const { csv } = await request<{ csv: string }>(`/export?${query({ ...filter })}`);
  const url = URL.createObjectURL(new Blob([csv.startsWith("\ufeff") ? csv : `\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `App分享记录-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
