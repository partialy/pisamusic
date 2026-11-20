import { fetchWithAuth, parseJson } from "./client";
import type {
  AdminQuotaStateItem,
  BatchQuotaOverridePayload,
  QuotaLimits,
  QuotaOverridePayload,
  SongDownloadOverviewStats,
  SongDownloadRecordItem,
  SongDownloadSubjectType,
  TopDownloadedSongItem,
} from "../types/songDownloads";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const str = sp.toString();
  return str ? `?${str}` : "";
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = await parseJson<T>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchSongDownloadOverview(days: 7 | 30 | 90): Promise<SongDownloadOverviewStats> {
  const res = await fetchWithAuth(`/api/admin/song-downloads/overview${buildQuery({ days })}`);
  return unwrap(res);
}

export async function fetchTopDownloadedSongs(params: {
  days: 7 | 30 | 90 | "all";
  source?: string;
  offset?: number;
  limit?: number;
}): Promise<{ items: TopDownloadedSongItem[]; total: number; offset: number; limit: number }> {
  const res = await fetchWithAuth(`/api/admin/song-downloads/top-songs${buildQuery(params)}`);
  return unwrap(res);
}

export async function fetchSongDownloadRecords(params: {
  keyword?: string;
  source?: string;
  platform?: string;
  subjectType?: string;
  userId?: string;
  deviceId?: string;
  startDay?: string;
  endDay?: string;
  offset?: number;
  limit?: number;
}): Promise<{ items: SongDownloadRecordItem[]; total: number; offset: number; limit: number }> {
  const res = await fetchWithAuth(`/api/admin/song-downloads/records${buildQuery(params)}`);
  return unwrap(res);
}

export async function fetchDefaultDownloadQuota(): Promise<QuotaLimits> {
  const res = await fetchWithAuth("/api/admin/song-downloads/default-quota");
  return unwrap(res);
}

export async function saveDefaultDownloadQuota(payload: QuotaLimits): Promise<QuotaLimits> {
  const res = await fetchWithAuth("/api/admin/song-downloads/default-quota", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return unwrap(res);
}

export async function fetchQuotaStates(params: {
  subjectType?: string;
  keyword?: string;
  offset?: number;
  limit?: number;
}): Promise<{ items: AdminQuotaStateItem[]; total: number; offset: number; limit: number }> {
  const res = await fetchWithAuth(`/api/admin/song-downloads/quotas${buildQuery(params)}`);
  return unwrap(res);
}

export async function fetchSubjectQuotaDetail(
  subjectType: SongDownloadSubjectType,
  subjectKey: string,
): Promise<AdminQuotaStateItem> {
  const res = await fetchWithAuth(
    `/api/admin/song-downloads/quotas/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectKey)}`,
  );
  return unwrap(res);
}

export async function saveSubjectQuotaOverride(
  subjectType: SongDownloadSubjectType,
  subjectKey: string,
  payload: QuotaOverridePayload,
): Promise<AdminQuotaStateItem> {
  const res = await fetchWithAuth(
    `/api/admin/song-downloads/quotas/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectKey)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return unwrap(res);
}

export async function saveBatchSubjectQuotaOverride(
  payload: BatchQuotaOverridePayload,
): Promise<{ updatedCount: number }> {
  const res = await fetchWithAuth("/api/admin/song-downloads/quotas/batch", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return unwrap(res);
}
