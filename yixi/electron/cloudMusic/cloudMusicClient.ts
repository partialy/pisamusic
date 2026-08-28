import { requestSystem, resolveSystemAssetUrl, unwrapResponse } from "../system/systemClient";
import type {
  CloudMusicResourceUrl,
  CloudMusicSearchResult,
  CloudMusicSummary,
  CloudMusicTrackDto,
} from "../../src/types/cloudMusic";

export async function getCloudMusicSummary(): Promise<CloudMusicSummary> {
  const response = await requestSystem<CloudMusicSummary>("/api/cloud-music/summary");
  return unwrapResponse(response);
}

export async function searchCloudMusic(input: {
  keyword?: string;
  offset?: number;
  limit?: number;
}): Promise<CloudMusicSearchResult> {
  const params = new URLSearchParams();
  if (input.keyword && input.keyword.trim()) {
    params.set("keyword", input.keyword.trim());
  }
  if (typeof input.offset === "number" && input.offset >= 0) {
    params.set("offset", String(input.offset));
  }
  const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, input.limit)) : 20;
  params.set("limit", String(limit));

  const query = params.toString();
  const path = query ? `/api/cloud-music/search?${query}` : "/api/cloud-music/search";
  const response = await requestSystem<CloudMusicSearchResult>(path);
  const result = unwrapResponse(response);

  return {
    ...result,
    items: (result.items || []).map(normalizeCloudTrackCover),
  };
}

export async function getCloudMusicTrackDetail(uuid: string): Promise<CloudMusicTrackDto> {
  const cleanUuid = (uuid || "").trim();
  if (!cleanUuid) {
    throw new Error("曲目 UUID 不能为空");
  }
  const response = await requestSystem<CloudMusicTrackDto>(`/api/cloud-music/tracks/${encodeURIComponent(cleanUuid)}`);
  const track = unwrapResponse(response);
  return normalizeCloudTrackCover(track);
}

export async function getCloudMusicPlayUrl(uuid: string): Promise<CloudMusicResourceUrl> {
  const cleanUuid = (uuid || "").trim();
  if (!cleanUuid) {
    throw new Error("曲目 UUID 不能为空");
  }
  const response = await requestSystem<CloudMusicResourceUrl>(`/api/cloud-music/tracks/${encodeURIComponent(cleanUuid)}/play-url`);
  return unwrapResponse(response);
}

export async function getCloudMusicLyricsUrl(uuid: string): Promise<CloudMusicResourceUrl> {
  const cleanUuid = (uuid || "").trim();
  if (!cleanUuid) {
    throw new Error("曲目 UUID 不能为空");
  }
  const response = await requestSystem<CloudMusicResourceUrl>(`/api/cloud-music/tracks/${encodeURIComponent(cleanUuid)}/lyrics-url`);
  return unwrapResponse(response);
}

function normalizeCloudTrackCover(track: CloudMusicTrackDto): CloudMusicTrackDto {
  if (!track || !track.cover) return track;
  const coverUrl = track.cover.url || "";
  const absoluteUrl = coverUrl ? resolveSystemAssetUrl(coverUrl) : "";
  return {
    ...track,
    cover: {
      ...track.cover,
      url: absoluteUrl,
    },
  };
}
