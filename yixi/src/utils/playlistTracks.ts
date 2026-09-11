import type { CommonPlaylist, Song } from "@/types/song";
import { getPlaylistDetail, getPlaylistTracks } from "@/utils/api/musicAPI";
import { convertor } from "@/utils/convertor";

/**
 * 根据歌单总曲目数动态计算单页/单批拉取大小。
 * 目标是将全量加载平摊为约 3 批次，并强制限制在 [50, 200] 黄金性能区间内：
 * - 小于等于 150 首时单批 50；
 * - 301 首时单批 Math.ceil(301 / 3) = 101；
 * - 大于等于 600 首时单批 200。
 */
export function resolveDynamicBatchSize(totalCount: number): number {
  if (!Number.isFinite(totalCount) || totalCount <= 0) return 50;
  return Math.min(200, Math.max(50, Math.ceil(totalCount / 3)));
}

type SupportedPlaylistSource = "kg" | "wy" | "local";
type NetworkPlaylistSource = Exclude<SupportedPlaylistSource, "local">;

export async function fetchAllPlaylistTracks(playlist: CommonPlaylist): Promise<Song[]> {
  const source = assertSupportedSource(playlist.source);
  if (source === "local") {
    const tracks = await window.electronAPI.listUserPlaylistTracks({ playlistId: playlist.id });
    return tracks.map((track) => track.payload as Song);
  }

  const total = await fetchPlaylistTotal(playlist, source);
  const songs: Song[] = [];
  const songKeys = new Set<string>();
  const batchSize = total ? resolveDynamicBatchSize(total) : 50;

  let offset = 0;
  while (!total || offset < total) {
    const pageSongs = await fetchPlaylistTrackPage(playlist.id, source, offset, batchSize);

    if (!pageSongs.length) break;
    appendUniqueSongs(songs, songKeys, pageSongs);

    offset += batchSize;
    if (!total && pageSongs.length < batchSize) break;
  }

  return songs;
}

function assertSupportedSource(source: CommonPlaylist["source"]): SupportedPlaylistSource {
  if (source === "kg" || source === "wy" || source === "local") return source;
  throw new Error("暂不支持该来源歌单播放");
}

async function fetchPlaylistTotal(playlist: CommonPlaylist, source: NetworkPlaylistSource) {
  try {
    const detail: any = await getPlaylistDetail({
      source,
      id: playlist.id,
    });

    if (source === "wy") {
      return toPositiveNumber(detail?.playlist?.trackCount) || toPositiveNumber(playlist.song_count);
    }

    return toPositiveNumber(detail?.data?.[0]?.count) || toPositiveNumber(playlist.song_count);
  } catch {
    return toPositiveNumber(playlist.song_count);
  }
}

async function fetchPlaylistTrackPage(
  id: string,
  source: NetworkPlaylistSource,
  offset: number,
  pageSize: number
) {
  const res: any = await getPlaylistTracks({
    source,
    id,
    offset,
    pageSize,
  });

  if (source === "wy") {
    const rawList = Array.isArray(res?.songs) ? res.songs : [];
    return rawList.map((item: any) => convertor.WY.convertPlaylistSong(item));
  }

  const rawList = Array.isArray(res?.data?.info) ? res.data.info : [];
  return rawList.map((item: any) => convertor.KG.convertKGPlaylistSong(item));
}

function appendUniqueSongs(target: Song[], songKeys: Set<string>, songs: Song[]) {
  songs.forEach((song) => {
    const key = `${song.source}:${song.id}`;
    if (songKeys.has(key)) return;
    songKeys.add(key);
    target.push(song);
  });
}

function toPositiveNumber(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}
