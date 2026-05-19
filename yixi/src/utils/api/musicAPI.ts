import type { Song } from "@/types/song";
import { reportError } from "@/utils/errorReporter";
import { toRaw } from 'vue';

export type SearchableMusicSource = "kg" | "wy" | "kw";

export type MusicSearchPayload = {
  source: SearchableMusicSource;
  keywords: string;
  page?: number;
  pageSize?: number;
};

export type PlaylistSearchPayload = {
  source: "kg" | "wy";
  keywords: string;
  page?: number;
  pageSize?: number;
};

export async function searchMusic<T = any>(payload: MusicSearchPayload): Promise<T> {
  return invokeMusicApi("searchMusic", payload, () => window.electronAPI.searchMusic<T>(payload));
}

export async function searchSuggest<T = any>(keywords: string): Promise<T> {
  const payload = { source: "wy" as const, keywords };
  return invokeMusicApi("searchSuggest", payload, () => window.electronAPI.searchSuggest<T>(payload));
}

export async function searchPlaylists<T = any>(payload: PlaylistSearchPayload): Promise<T> {
  return invokeMusicApi("searchPlaylists", payload, () => window.electronAPI.searchPlaylists<T>(payload));
}

export async function getKgPlaylistTags<T = any>(): Promise<T> {
  return invokeMusicApi("getKgPlaylistTags", {}, () => window.electronAPI.getKgPlaylistTags<T>());
}

export async function getTopPlaylists<T = any>(payload: {
  source: "kg";
  categoryId?: string | number;
  page?: number;
  pageSize?: number;
}): Promise<T> {
  return invokeMusicApi("getTopPlaylists", payload, () => window.electronAPI.getTopPlaylists<T>(payload));
}

export async function getKgDailyRecommend<T = any>(platform?: string): Promise<T> {
  return invokeMusicApi("getKgDailyRecommend", { platform }, () =>
    window.electronAPI.getKgDailyRecommend<T>(platform)
  );
}

export async function getHomeRecommendations<T = any>(): Promise<T> {
  return invokeMusicApi("getHomeRecommendations", {}, () =>
    window.electronAPI.getHomeRecommendations<T>()
  );
}

export async function getPlaylistDetail<T = any>(payload: {
  source: "kg" | "wy";
  id: string;
}): Promise<T> {
  return invokeMusicApi("getPlaylistDetail", payload, () => window.electronAPI.getPlaylistDetail<T>(payload));
}

export async function getPlaylistTracks<T = any>(payload: {
  source: "kg" | "wy";
  id: string;
  offset?: number;
  page?: number;
  pageSize?: number;
}): Promise<T> {
  return invokeMusicApi("getPlaylistTracks", payload, () => window.electronAPI.getPlaylistTracks<T>(payload));
}

export async function getDynamicCover<T = any>(id: string | number): Promise<T> {
  const payload = { source: "wy" as const, id };
  return invokeMusicApi("getDynamicCover", payload, () => window.electronAPI.getDynamicCover<T>(payload));
}

export async function getPlayableUrlByMusicApi(song: Song, qualityKey?: string) {
  const rawSong = toRaw(song);
  const payload = {
    source: rawSong.source,
    id: String(rawSong.id || ""),
    urlParam: rawSong.urlParam ? String(rawSong.urlParam) : undefined,
    filePath: rawSong.filePath ? String(rawSong.filePath) : undefined,
    qualityKey: qualityKey ? String(toRaw(qualityKey)) : undefined,
  };
  try {
    const url = await window.electronAPI.resolvePlayableUrl(payload);
    return url || "";
  } catch (error) {
    void reportError(error, {
      scope: "music",
      action: "resolvePlayableUrl",
      songId: payload.id,
      source: payload.source,
      qualityKey: payload.qualityKey,
    });
    return "";
  }
}

export async function fetchLyricsByMusicApi(song: Song) {
  const payload = {
    source: song.source as SearchableMusicSource,
    id: song.id,
    hash: song.urlParam,
  };
  return invokeMusicApi("fetchLyrics", payload, () => window.electronAPI.fetchLyrics(payload));
}

async function invokeMusicApi<T>(
  action: string,
  payload: Record<string, unknown>,
  invoker: () => Promise<T>
) {
  try {
    return await invoker();
  } catch (error) {
    void reportError(error, {
      scope: "music",
      action,
      payload,
    });
    throw error;
  }
}
