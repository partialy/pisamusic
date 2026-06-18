import type { CommonPlaylist, Song } from "@/types/song";
import { normalizePlaylist } from "@/utils/playlist";
import { normalizeSong } from "@/utils/song";

export type ShareType = "song" | "playlist";

export type SharePublicSharer = {
  id: string;
  username: string;
  avatarUrl: string;
};

export type PublicShareRecord = {
  uuid: string;
  type: ShareType;
  source: string;
  sourceId: string;
  title: string;
  description: string;
  coverUrl: string;
  rawJson: Record<string, unknown>;
  sharer: SharePublicSharer;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  valid: boolean;
};

export type ShareCreateResult = {
  uuid: string;
  shareUrl: string;
  appUrl: string;
  share: PublicShareRecord;
};

export type SongSharePayload = Pick<
  Song,
  "id" | "source" | "urlParam" | "name" | "singer" | "album" | "cover" | "coverSize" | "duration" | "vip"
>;

export type PlaylistSharePayload = Pick<
  CommonPlaylist,
  "id" | "source" | "name" | "desc" | "cover" | "coverSize" | "tags" | "song_count" | "play_count" | "collect_count"
>;

export type MediaDetailRoutePayload =
  | { kind: "song"; song: SongSharePayload }
  | { kind: "playlist"; playlist: PlaylistSharePayload };

export function toSongSharePayload(input: Song | Record<string, unknown>): SongSharePayload {
  const song = normalizeSong(input as Record<string, unknown>);
  return {
    id: song.id,
    source: song.source,
    urlParam: song.urlParam || song.id,
    name: song.name,
    singer: song.singer,
    album: song.album,
    cover: safeRemoteCover(song.cover),
    coverSize: normalizeCoverSize(song.coverSize),
    duration: song.duration,
    vip: song.vip,
  };
}

export function toPlaylistSharePayload(
  input: CommonPlaylist | Record<string, unknown>
): PlaylistSharePayload {
  const playlist = normalizePlaylist(input as Record<string, unknown>);
  return {
    id: playlist.id,
    source: playlist.source,
    name: playlist.name,
    desc: playlist.desc,
    cover: safeRemoteCover(playlist.cover),
    coverSize: normalizeCoverSize(playlist.coverSize),
    tags: playlist.tags,
    song_count: playlist.song_count,
    play_count: playlist.play_count,
    collect_count: playlist.collect_count,
  };
}

export function songFromSharePayload(input: Record<string, unknown>): Song {
  return normalizeSong({
    ...input,
    cover: safeRemoteCover(input.cover),
  });
}

export function playlistFromSharePayload(input: Record<string, unknown>): CommonPlaylist {
  return normalizePlaylist({
    ...input,
    cover: safeRemoteCover(input.cover),
  });
}

export function encodeMediaDetailPayload(payload: MediaDetailRoutePayload): string {
  const json = JSON.stringify(payload);
  return btoa(encodeURIComponent(json));
}

export function decodeMediaDetailPayload(raw: unknown): MediaDetailRoutePayload | null {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (typeof text !== "string" || !text) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(text))) as MediaDetailRoutePayload;
    if (parsed.kind === "song" && parsed.song) {
      return { kind: "song", song: toSongSharePayload(parsed.song) };
    }
    if (parsed.kind === "playlist" && parsed.playlist) {
      return { kind: "playlist", playlist: toPlaylistSharePayload(parsed.playlist) };
    }
  } catch {
    return null;
  }
  return null;
}

function safeRemoteCover(value: unknown): string {
  if (typeof value !== "string") return "";
  const cover = value.trim();
  if (!cover) return "";
  if (/^https?:\/\//i.test(cover) || cover.startsWith("data:image/svg+xml")) return cover;
  return "";
}

function normalizeCoverSize(value: Song["coverSize"] | CommonPlaylist["coverSize"] | undefined) {
  if (!value) return undefined;
  return {
    s: safeRemoteCover(value.s),
    m: safeRemoteCover(value.m),
    l: safeRemoteCover(value.l),
    xl: safeRemoteCover(value.xl),
  };
}
