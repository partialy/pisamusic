import type {
  CloudMusicAdminCompleteAudioInput,
  CloudMusicAdminSaveInput,
  CloudMusicAssetKind,
  CloudMusicAssetUploadTicket,
  CloudMusicBatchDraftItem,
  CloudMusicListFilter,
  CloudMusicListResponse,
  CloudMusicLyricsText,
  CloudMusicResourceUrls,
  CloudMusicReviewInput,
  CloudMusicSelectedFiles,
  CloudMusicTempCleanupResult,
  CloudMusicTempSummary,
  CloudMusicTrack,
  CloudMusicUploadSession,
  CloudMusicUploadTaskPhase,
} from "../types/cloudMusic";
import { buildLyricsFileFromDraft } from "../utils/cloudMusicLyrics";
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

export async function fetchCloudMusicLyricsText(uuid: string): Promise<CloudMusicLyricsText> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}/lyrics`);
  const body = await parseJson<CloudMusicLyricsText>(res);
  if (!res.ok || !body.success || body.data == null) throw new Error(body.msg || `HTTP ${res.status}`);
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

export function resolveFileMimeType(file: File, fallback: string): string {
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

export async function completeCloudMusicAsset(
  uuid: string,
  kind: CloudMusicAssetKind,
  parsedInput?: CloudMusicAdminCompleteAudioInput,
): Promise<CloudMusicTrack> {
  const res = await fetchWithAuth(`/api/admin/cloud-music/${encodeURIComponent(uuid)}/assets/${kind}/complete`, {
    method: "POST",
    body: parsedInput ? JSON.stringify(parsedInput) : undefined,
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

/**
 * 执行单曲完整上传闭环：创建会话 -> 直传七牛 (音频/封面/歌词) -> 确认资产 -> 保存元数据并激活状态
 */
export async function executeCloudMusicBatchTask(
  draft: CloudMusicBatchDraftItem,
  onProgress?: (state: { phase: CloudMusicUploadTaskPhase; percent: number }) => void,
): Promise<CloudMusicTrack> {
  const lyricsFile = buildLyricsFileFromDraft(draft);
  const coverFile = draft.coverFile ?? undefined;

  onProgress?.({ phase: "reserving", percent: 5 });
  const session = await createCloudMusicUploadSession({
    audio: draft.audioFile,
    cover: coverFile,
    lyrics: lyricsFile,
  });

  const audioTicket = session.tickets.find((t) => t.kind === "audio");
  if (!audioTicket) throw new Error("缺少音频上传凭证");

  onProgress?.({ phase: "audio", percent: 0 });
  await uploadFileToQiniu(
    draft.audioFile,
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

  await completeCloudMusicAsset(session.uuid, "audio", {
    title: draft.title.trim(),
    artist: draft.artist.trim(),
    album: draft.album.trim(),
    durationMs: draft.durationMs,
    ...draft.specs,
  });

  const coverTicket = session.tickets.find((t) => t.kind === "cover-uploaded");
  if (coverTicket && coverFile) {
    onProgress?.({ phase: "cover", percent: 0 });
    await uploadFileToQiniu(
      coverFile,
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
    await completeCloudMusicAsset(session.uuid, "cover-uploaded");
  }

  const lyricsTicket = session.tickets.find((t) => t.kind === "lyrics");
  if (lyricsTicket && lyricsFile) {
    onProgress?.({ phase: "lyrics", percent: 0 });
    await uploadFileToQiniu(
      lyricsFile,
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
    await completeCloudMusicAsset(session.uuid, "lyrics");
  }

  onProgress?.({ phase: "saving", percent: 98 });
  const saved = await saveCloudMusic(session.uuid, {
    title: draft.title.trim(),
    artist: draft.artist.trim(),
    album: draft.album.trim(),
    durationMs: draft.durationMs,
    status: draft.status,
    statusReason: draft.statusReason.trim(),
    ...draft.specs,
  });

  onProgress?.({ phase: "done", percent: 100 });
  return saved;
}
