// yixi Song 与一起听协议歌曲的映射。
// 约束：不向房间发送本地 filePath 与真实播放 URL；接收远端歌曲后由本端自行取链播放。

import type { Song } from "../types/song";
import type {
  ListenTogetherSong,
  ListenTogetherSongRef,
} from "../types/listenTogether";

/** 服务端要求 name/singer 非空，空值用占位文案兜底（仅影响展示，不影响歌曲身份） */
const FALLBACK_SONG_NAME = "未知歌曲";
const FALLBACK_SINGER = "未知歌手";

/** 是否允许进入一起听房间：必须有 id，且不能是本地歌曲 */
export function canShareSong(song: Pick<Song, "id" | "source"> | null | undefined): boolean {
  if (!song) return false;
  if (!song.id) return false;
  return song.source !== "local";
}

/**
 * yixi Song → 协议歌曲。
 * url 固定发空字符串（避免传播短期/账号相关播放地址），不携带 filePath。
 */
export function toListenTogetherSong(song: Song): ListenTogetherSong {
  return {
    id: song.id,
    source: song.source,
    urlParam: song.urlParam || song.id,
    name: song.name || FALLBACK_SONG_NAME,
    singer: song.singer || FALLBACK_SINGER,
    album: song.album || "",
    cover: song.cover || "",
    ...(song.coverSize ? { coverSize: { ...song.coverSize } } : {}),
    url: "",
    duration: Math.max(0, Math.floor(song.duration || 0)),
    ...(typeof song.vip === "boolean" ? { vip: song.vip } : {}),
    ...(song.size ? { size: { ...song.size } } : {}),
  };
}

/**
 * 协议歌曲 → yixi Song。
 * 不信任远端 url（置空，播放时经现有取链逻辑获取本端可播地址），不还原 filePath。
 */
export function fromListenTogetherSong(remote: ListenTogetherSong): Song {
  return {
    id: remote.id,
    source: remote.source,
    urlParam: remote.urlParam || remote.id,
    name: remote.name,
    singer: remote.singer,
    album: remote.album || "",
    cover: remote.cover || "",
    ...(remote.coverSize ? { coverSize: { ...remote.coverSize } } : {}),
    url: "",
    duration: Math.max(0, Math.floor(remote.duration || 0)),
    ...(typeof remote.vip === "boolean" ? { vip: remote.vip } : {}),
    ...(remote.size ? { size: { ...remote.size } } : {}),
  };
}

export function songRefOf(
  song: Pick<Song, "source" | "id"> | Pick<ListenTogetherSong, "source" | "id">,
): ListenTogetherSongRef {
  return { source: song.source, id: song.id };
}

export function sameSongRef(
  a: ListenTogetherSongRef | null | undefined,
  b: ListenTogetherSongRef | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.source.toLowerCase() === b.source.toLowerCase() && a.id === b.id;
}

/** 队列/播放器通用歌曲键：source:id */
export function songKeyOf(song: Pick<Song, "source" | "id">): string {
  return `${song.source}:${song.id}`;
}
