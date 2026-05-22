export type RecommendPlaylistType = "kg-top" | "wy-top" | "wy-personalized";
export type RecommendSongType = "kg-daily" | "kg-top" | "wy-new";

type SourceMeta<T extends string> = {
  type: T;
  title: string;
};

export const PLAYLIST_SOURCE_META: Record<RecommendPlaylistType, SourceMeta<RecommendPlaylistType>> = {
  "kg-top": { type: "kg-top", title: "推荐歌单" },
  "wy-top": { type: "wy-top", title: "网友精选碟" },
  "wy-personalized": { type: "wy-personalized", title: "WY推荐歌单" },
};

export const SONG_SOURCE_META: Record<RecommendSongType, SourceMeta<RecommendSongType>> = {
  "kg-daily": { type: "kg-daily", title: "推荐音乐" },
  "kg-top": { type: "kg-top", title: "热门歌曲" },
  "wy-new": { type: "wy-new", title: "WY推荐歌曲" },
};

export function normalizePlaylistType(value: unknown): RecommendPlaylistType {
  return normalizeType(value, PLAYLIST_SOURCE_META, "kg-top");
}

export function normalizeSongType(value: unknown): RecommendSongType {
  return normalizeType(value, SONG_SOURCE_META, "kg-daily");
}

export function queryString(value: unknown) {
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function normalizeType<T extends string>(
  value: unknown,
  meta: Record<T, SourceMeta<T>>,
  fallback: T
) {
  const next = queryString(value);
  return next && next in meta ? (next as T) : fallback;
}
