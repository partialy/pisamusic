import type { CommonPlaylist } from "@/types/song";
import { normalizePlaylist } from "@/utils/playlist";
import type { CookieSource } from "@/utils/api/cookieMusicAPI";

export type CookieUserPlaylistPage = {
  items: CommonPlaylist[];
  rawCount: number;
  totalCount?: number;
  hasMore: boolean;
};

export function convertCookieUserPlaylists(source: CookieSource, response: unknown): CommonPlaylist[] {
  return parseCookieUserPlaylistPage(source, response).items;
}

export function parseCookieUserPlaylistPage(
  source: CookieSource,
  response: unknown
): CookieUserPlaylistPage {
  return source === "kg" ? parseKgUserPlaylistPage(response) : parseWyUserPlaylistPage(response);
}

function parseKgUserPlaylistPage(response: unknown): CookieUserPlaylistPage {
  const root = toRecord(response);
  const status = root.status !== undefined ? Number(root.status) : 1;
  const errorCode = root.error_code !== undefined ? Number(root.error_code) : 0;
  if (status !== 1 || (Number.isFinite(errorCode) && errorCode !== 0)) {
    throw new Error(scalar(root.msg) || scalar(root.message) || "拉取酷狗歌单失败，请检查登录状态");
  }

  const data = toRecord(root.data);
  const rawItems = toArray(data.info);
  const rawTotal = Number(data.list_count);
  const totalCount = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : undefined;
  const items: CommonPlaylist[] = [];

  for (const entry of rawItems) {
    const raw = toRecord(entry);
    const listidNum = Number(raw.listid);
    const id =
      scalar(raw.global_collection_id) ||
      scalar(raw.list_create_gid) ||
      (Number.isFinite(listidNum) && listidNum > 0 ? String(listidNum) : "");
    const name = scalar(raw.name);
    if (!id || !name) continue;

    try {
      items.push(
        normalizePlaylist({
          id,
          source: "kg",
          name,
          desc: scalar(raw.list_create_username),
          cover: normalizeKgCover(scalar(raw.pic) || scalar(raw.create_user_pic)),
          song_count: raw.count ?? raw.m_count ?? 0,
          play_count: raw.play_count,
          collect_count: raw.collect_count,
          tags: [],
        })
      );
    } catch {
      // 跳过字段异常的单条歌单，避免阻断整页拉取
    }
  }

  return {
    items,
    rawCount: rawItems.length,
    totalCount,
    hasMore: rawItems.length > 0,
  };
}

function parseWyUserPlaylistPage(response: unknown): CookieUserPlaylistPage {
  const root = toRecord(response);
  const code = root.code !== undefined ? Number(root.code) : 200;
  if (code !== 200) {
    throw new Error(scalar(root.msg) || scalar(root.message) || "拉取网易云歌单失败，请检查登录状态");
  }

  const rawItems = toArray(root.playlist);
  const items: CommonPlaylist[] = [];

  for (const entry of rawItems) {
    const raw = toRecord(entry);
    const idNum = Number(raw.id);
    const id = Number.isFinite(idNum) && idNum > 0 ? String(idNum) : scalar(raw.id);
    const name = scalar(raw.name);
    if (!id || !name) continue;

    const tags = toArray(raw.tags)
      .map((tag) => scalar(tag))
      .filter(Boolean)
      .map((tag) => ({ name: tag, id: tag }));

    try {
      items.push(
        normalizePlaylist({
          id,
          source: "wy",
          name,
          desc: scalar(raw.description),
          cover: scalar(raw.coverImgUrl),
          song_count: raw.trackCount ?? 0,
          play_count: raw.playCount,
          collect_count: raw.subscribedCount,
          tags,
        })
      );
    } catch {
      // 跳过字段异常的单条歌单
    }
  }

  return {
    items,
    rawCount: rawItems.length,
    hasMore: Boolean(root.more) && rawItems.length > 0,
  };
}

function normalizeKgCover(cover: string) {
  if (!cover) return "";
  return cover;
}

function scalar(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
