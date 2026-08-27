import type {
  CloudMusicAdminSaveInput,
  CloudMusicAssetKind,
  CloudMusicAssetUploadTicket,
  CloudMusicListFilter,
  CloudMusicListResponse,
  CloudMusicResourceUrls,
  CloudMusicReviewInput,
  CloudMusicSelectedFiles,
  CloudMusicTempCleanupResult,
  CloudMusicTempSummary,
  CloudMusicTrack,
  CloudMusicUploadSession,
} from "../types/cloudMusic";
import { fetchWithAuth, parseJson, uploadFileToQiniu } from "./client";

export async function fetchCloudMusicTracks(filter: CloudMusicListFilter): Promise<CloudMusicListResponse> {
  const params = new URLSearchParams();
  if (filter.keyword) params.set("keyword", filter.keyword);
  if (filter.status && filter.status !== "all") params.set("status", filter.status);
  if (filter.uploadState && filter.uploadState !== "all") params.set("uploadState", filter.uploadState);
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));

  const query = params.toString();
  const res = await fetchWithAuth(`/api/admin/cloud-music${query ? `?${query}` : ""}`);
  const body = await parseJson<CloudMusicListResponse>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchCloudMusicDetail(uuid: string): Promise<CloudMusicTrack> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}`);
  const body = await parseJson<CloudMusicTrack>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchCloudMusicPreviewUrl(uuid: string): Promise<CloudMusicResourceUrls> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}/preview-url`);
  const body = await parseJson<CloudMusicResourceUrls>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

function resolveFileMimeType(file: File, fallback: string): string {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type;
  }
  const ext = file.name.toLowerCase();
  if (ext.endsWith(".flac")) return "audio/flac";
  if (ext.endsWith(".mp3")) return "audio/mpeg";
  if (ext.endsWith(".m4a") || ext.endsWith(".mp4")) return "audio/mp4";
  if (ext.endsWith(".aac")) return "audio/aac";
  if (ext.endsWith(".ogg")) return "audio/ogg";
  if (ext.endsWith(".opus")) return "audio/opus";
  if (ext.endsWith(".wav")) return "audio/wav";
  if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) return "image/jpeg";
  if (ext.endsWith(".png")) return "image/png";
  if (ext.endsWith(".webp")) return "image/webp";
  if (ext.endsWith(".lrc") || ext.endsWith(".txt")) return "text/plain";
  return fallback;
}

export async function createCloudMusicUploadSession(files: CloudMusicSelectedFiles): Promise<CloudMusicUploadSession> {
  const res = await fetchWithAuth("/api/admin/cloud-music/upload-sessions", {
    method: "POST",
    body: JSON.stringify({
      audio: {
        fileName: files.audio.name,
        fileSize: files.audio.size,
        mimeType: resolveFileMimeType(files.audio, "audio/flac"),
      },
      cover: files.cover
        ? {
            fileName: files.cover.name,
            fileSize: files.cover.size,
            mimeType: resolveFileMimeType(files.cover, "image/jpeg"),
          }
        : undefined,
      lyrics: files.lyrics
        ? {
            fileName: files.lyrics.name,
            fileSize: files.lyrics.size,
            mimeType: resolveFileMimeType(files.lyrics, "text/plain"),
          }
        : undefined,
    }),
  });
  const body = await parseJson<CloudMusicUploadSession>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function reserveCloudMusicAsset(
  uuid: string,
  file: File,
  kind: "cover-uploaded" | "lyrics",
): Promise<CloudMusicAssetUploadTicket> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}/assets/${kind}/reserve`, {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: resolveFileMimeType(file, kind === "lyrics" ? "text/plain" : "image/jpeg"),
    }),
  });
  const body = await parseJson<CloudMusicAssetUploadTicket>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function completeCloudMusicAsset(uuid: string, kind: CloudMusicAssetKind): Promise<CloudMusicTrack> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}/assets/${kind}/complete`, {
    method: "POST",
  });
  const body = await parseJson<CloudMusicTrack>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function removeCloudMusicManualCover(uuid: string): Promise<CloudMusicTrack> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}/cover`, {
    method: "DELETE",
  });
  const body = await parseJson<CloudMusicTrack>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function saveCloudMusic(uuid: string, payload: CloudMusicAdminSaveInput): Promise<CloudMusicTrack> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const body = await parseJson<CloudMusicTrack>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function reviewCloudMusic(uuid: string, payload: CloudMusicReviewInput): Promise<CloudMusicTrack> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = await parseJson<CloudMusicTrack>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function deleteCloudMusic(uuid: string): Promise<CloudMusicTrack> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}`, {
    method: "DELETE",
  });
  const body = await parseJson<CloudMusicTrack>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchCloudMusicTempSummary(): Promise<CloudMusicTempSummary> {
  const res = await fetchWithAuth("/api/admin/cloud-music/temp-summary");
  const body = await parseJson<CloudMusicTempSummary>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function cleanupCloudMusicTemp(olderThanHours: 0 | 24 | 72): Promise<CloudMusicTempCleanupResult> {
  const res = await fetchWithAuth("/api/admin/cloud-music/temp-cleanup", {
    method: "POST",
    body: JSON.stringify({ olderThanHours }),
  });
  const body = await parseJson<CloudMusicTempCleanupResult>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function uploadCloudMusicSession(
  session: CloudMusicUploadSession,
  files: CloudMusicSelectedFiles,
  onProgress?: (state: { phase: "audio" | "cover" | "lyrics" | "processing"; percent: number }) => void,
): Promise<CloudMusicTrack> {
  const audioTicket = session.tickets.find((t) => t.kind === "audio");
  if (!audioTicket) throw new Error("缺少音频上传凭证");

  onProgress?.({ phase: "audio", percent: 0 });
  await uploadFileToQiniu(
    files.audio,
    {
      uploadToken: audioTicket.uploadToken,
      uploadUrl: audioTicket.uploadUrl,
      key: audioTicket.key,
      bucket: "",
      domain: "",
      cdnDomain: "",
      downloadUrl: "",
      expiresAt: 0,
    },
    (percent) => onProgress?.({ phase: "audio", percent }),
  );

  onProgress?.({ phase: "processing", percent: 100 });
  let track = await completeCloudMusicAsset(session.uuid, "audio");

  const coverTicket = session.tickets.find((t) => t.kind === "cover-uploaded");
  if (coverTicket && files.cover) {
    onProgress?.({ phase: "cover", percent: 0 });
    await uploadFileToQiniu(
      files.cover,
      {
        uploadToken: coverTicket.uploadToken,
        uploadUrl: coverTicket.uploadUrl,
        key: coverTicket.key,
        bucket: "",
        domain: "",
        cdnDomain: "",
        downloadUrl: "",
        expiresAt: 0,
      },
      (percent) => onProgress?.({ phase: "cover", percent }),
    );
    track = await completeCloudMusicAsset(session.uuid, "cover-uploaded");
  }

  const lyricsTicket = session.tickets.find((t) => t.kind === "lyrics");
  if (lyricsTicket && files.lyrics) {
    onProgress?.({ phase: "lyrics", percent: 0 });
    await uploadFileToQiniu(
      files.lyrics,
      {
        uploadToken: lyricsTicket.uploadToken,
        uploadUrl: lyricsTicket.uploadUrl,
        key: lyricsTicket.key,
        bucket: "",
        domain: "",
        cdnDomain: "",
        downloadUrl: "",
        expiresAt: 0,
      },
      (percent) => onProgress?.({ phase: "lyrics", percent }),
    );
    track = await completeCloudMusicAsset(session.uuid, "lyrics");
  }

  return track;
}
