import type { Song } from "@/types/song";
import { getUrlByProxy } from "./proxyAPI";

export type SearchableMusicSource = "kg" | "wy" | "kw";

export type MusicSearchPayload = {
  source: SearchableMusicSource;
  keywords: string;
  page?: number;
  pageSize?: number;
};

export async function searchMusic<T = any>(payload: MusicSearchPayload): Promise<T> {
  return window.electronAPI.searchMusic<T>(payload);
}

export async function getPlayableUrlByMusicApi(song: Song) {
  try {
    const url = await window.electronAPI.resolvePlayableUrl({
      source: song.source as SearchableMusicSource,
      id: song.id,
      urlParam: song.urlParam,
    });
    return url || getUrlByProxy(song);
  } catch {
    return getUrlByProxy(song);
  }
}

export async function fetchLyricsByMusicApi(song: Song) {
  return window.electronAPI.fetchLyrics({
    source: song.source as SearchableMusicSource,
    id: song.id,
    hash: song.urlParam,
  });
}
