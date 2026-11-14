import type { CommonPlaylist, Song } from "@/types/song";
import { getPlaylistDetail } from "@/utils/api/musicAPI";
import { convertor } from "@/utils/convertor";
import { fetchPlaylistTrackPage, resolveDynamicBatchSize } from "@/utils/playlistTracks";

type Source = "kg" | "wy";
type LoadOptions = { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void };

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("已取消加载", "AbortError");
}

async function readDetail(source: Source, id: string) {
  const response = await getPlaylistDetail({ source, id });
  const raw = source === "wy" ? response?.playlist : response?.data?.[0];
  if (!raw || String(source === "wy" ? raw.id : raw.global_collection_id) !== id) throw new Error("歌单身份不匹配，未创建本地副本。");
  const count = Number(source === "wy" ? raw.trackCount : raw.count);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("无法确认歌单完整曲目数量，请稍后重试。");
  const playlist = source === "wy" ? convertor.WY.convertWYPlaylist(raw) : convertor.KG.convertKGPlaylist(raw, "detail");
  const version = source === "wy" ? raw.trackUpdateTime : raw.list_ver ?? raw.update_time;
  const trackIds: string[] | undefined = source === "wy" && Array.isArray(raw.trackIds)
    ? raw.trackIds.map((track: { id: unknown }) => String(track.id)) : undefined;
  return { playlist, count, version, trackIds };
}

/** 全集读取成功后才返回：固定页大小、原始读数核对、稳定身份去重、首尾版本复核。 */
export async function loadOnlinePlaylist(source: Source, id: string, options: LoadOptions = {}): Promise<{ playlist: CommonPlaylist; songs: Song[] }> {
  checkCancelled(options.signal);
  const initial = await readDetail(source, id);
  checkCancelled(options.signal);
  const size = resolveDynamicBatchSize(initial.count);
  const songs: Song[] = [];
  const keys = new Set<string>();
  const pages = new Set<string>();
  let rawCount = 0;
  options.onProgress?.(0, initial.count);
  while (rawCount < initial.count) {
    checkCancelled(options.signal);
    const page = await fetchPlaylistTrackPage(id, source, rawCount, size);
    checkCancelled(options.signal);
    if (!page.length || page.length > size || rawCount + page.length > initial.count) throw new Error("歌单分页不完整或已变化，请重新转换。");
    const pageKeys = page.map(song => `${song.source}:${song.id}`);
    const signature = JSON.stringify(pageKeys);
    if (pages.has(signature)) throw new Error("歌单接口返回重复分页，未保存不完整副本。");
    pages.add(signature);
    for (const song of page) {
      if (song.source !== source || !song.id) throw new Error("曲目身份异常，未保存歌单副本。");
      const key = `${song.source}:${song.id}`;
      if (!keys.has(key)) { keys.add(key); songs.push(song); }
    }
    rawCount += page.length;
    options.onProgress?.(rawCount, initial.count);
    if (page.length < size && rawCount !== initial.count) throw new Error("歌单提前结束，未保存不完整副本。");
  }
  const final = await readDetail(source, id);
  checkCancelled(options.signal);
  if (final.count !== initial.count || final.version !== initial.version) throw new Error("加载期间歌单已更新，请重新转换。");
  if (initial.trackIds && (initial.trackIds.length !== rawCount || JSON.stringify(initial.trackIds) !== JSON.stringify(final.trackIds)
    || initial.trackIds.some(trackId => !keys.has(`${source}:${trackId}`)))) throw new Error("歌单曲目核验失败，请重新转换。");
  return { playlist: { ...final.playlist, song_count: songs.length }, songs };
}
