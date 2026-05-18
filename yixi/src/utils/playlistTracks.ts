import type { CommonPlaylist, Song } from "@/types/song";
import { getPlaylistDetail, getPlaylistTracks } from "@/utils/api/musicAPI";
import { convertor } from "@/utils/convertor";

const PLAYLIST_TRACK_PAGE_SIZE = 300;

type SupportedPlaylistSource = "kg" | "wy";

export async function fetchAllPlaylistTracks(playlist: CommonPlaylist): Promise<Song[]> {
  const source = assertSupportedSource(playlist.source);
  const total = await fetchPlaylistTotal(playlist, source);
  const songs: Song[] = [];
  const songKeys = new Set<string>();

  let offset = 0;
  while (!total || offset < total) {
    const pageSize = total
      ? Math.min(PLAYLIST_TRACK_PAGE_SIZE, total - offset)
      : PLAYLIST_TRACK_PAGE_SIZE;
    const pageSongs = await fetchPlaylistTrackPage(playlist.id, source, offset, pageSize);

    if (!pageSongs.length) break;
    appendUniqueSongs(songs, songKeys, pageSongs);

    offset += pageSize;
    if (!total && pageSongs.length < pageSize) break;
  }

  return songs;
}

function assertSupportedSource(source: CommonPlaylist["source"]): SupportedPlaylistSource {
  if (source === "kg" || source === "wy") return source;
  throw new Error("暂不支持该来源歌单播放");
}

async function fetchPlaylistTotal(
  playlist: CommonPlaylist,
  source: SupportedPlaylistSource
) {
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
  source: SupportedPlaylistSource,
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
