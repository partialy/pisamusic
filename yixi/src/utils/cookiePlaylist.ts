import type { CommonPlaylist } from "@/types/song";
import { normalizePlaylist } from "@/utils/playlist";
import type { CookieSource } from "@/utils/api/cookieMusicAPI";

export function convertCookieUserPlaylists(source: CookieSource, response: unknown): CommonPlaylist[] {
  return source === "kg" ? convertKgUserPlaylists(response) : convertWyUserPlaylists(response);
}

function convertKgUserPlaylists(response: unknown): CommonPlaylist[] {
  const root = toRecord(response);
  const data = toRecord(root.data);
  const items = toArray(data.info);

  return items.map((item) => {
    const raw = toRecord(item);
    const id = scalar(raw.global_collection_id) || scalar(raw.list_create_gid) || scalar(raw.listid);
    return normalizePlaylist({
      id,
      source: "kg",
      name: scalar(raw.name),
      desc: scalar(raw.list_create_username),
      cover: normalizeKgCover(scalar(raw.pic)),
      song_count: raw.count ?? raw.m_count,
      play_count: raw.play_count,
      collect_count: raw.collect_count,
      tags: [],
    });
  });
}

function convertWyUserPlaylists(response: unknown): CommonPlaylist[] {
  const root = toRecord(response);
  const items = toArray(root.playlist);

  return items.map((item) => {
    const raw = toRecord(item);
    const tags = toArray(raw.tags)
      .map((tag) => scalar(tag))
      .filter(Boolean)
      .map((tag) => ({ name: tag, id: tag }));

    return normalizePlaylist({
      id: scalar(raw.id),
      source: "wy",
      name: scalar(raw.name),
      desc: scalar(raw.description),
      cover: scalar(raw.coverImgUrl),
      song_count: raw.trackCount,
      play_count: raw.playCount,
      collect_count: raw.subscribedCount,
      tags,
    });
  });
}

function normalizeKgCover(cover: string) {
  if (!cover) return "";
  return cover.replace("{size}", "400");
}

function scalar(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
