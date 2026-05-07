import type { Song } from "@/types/song";

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
  return window.electronAPI.searchMusic<T>(payload);
}

export async function searchSuggest<T = any>(keywords: string): Promise<T> {
  return window.electronAPI.searchSuggest<T>({ source: "wy", keywords });
}

export async function searchPlaylists<T = any>(payload: PlaylistSearchPayload): Promise<T> {
  return window.electronAPI.searchPlaylists<T>(payload);
}

export async function getKgPlaylistTags<T = any>(): Promise<T> {
  return window.electronAPI.getKgPlaylistTags<T>();
}

export async function getTopPlaylists<T = any>(payload: {
  source: "kg";
  categoryId?: string | number;
  page?: number;
  pageSize?: number;
}): Promise<T> {
  return window.electronAPI.getTopPlaylists<T>(payload);
}

export async function getKgDailyRecommend<T = any>(platform?: string): Promise<T> {
  return window.electronAPI.getKgDailyRecommend<T>(platform);
}

export async function getPlaylistDetail<T = any>(payload: {
  source: "kg" | "wy";
  id: string;
}): Promise<T> {
  return window.electronAPI.getPlaylistDetail<T>(payload);
}

export async function getPlaylistTracks<T = any>(payload: {
  source: "kg" | "wy";
  id: string;
  page?: number;
  pageSize?: number;
}): Promise<T> {
  return window.electronAPI.getPlaylistTracks<T>(payload);
}

export async function getPlayableUrlByMusicApi(song: Song) {
  try {
    const url = await window.electronAPI.resolvePlayableUrl({
      source: song.source as SearchableMusicSource,
      id: song.id,
      urlParam: song.urlParam,
    });
    return url || "";
  } catch {
    return "";
  }
}

export async function fetchLyricsByMusicApi(song: Song) {
  return window.electronAPI.fetchLyrics({
    source: song.source as SearchableMusicSource,
    id: song.id,
    hash: song.urlParam,
  });
}
