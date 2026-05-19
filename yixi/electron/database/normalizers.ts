import type { PlaylistSnapshot, PlaylistSource, TrackSnapshot } from "./types";

export function favoriteKey(source: string, id: string) {
  return `${source}:${id}`;
}

export function requireFavoriteIdentity(item: { id?: unknown; source?: unknown }, label: string) {
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const source = typeof item.source === "string" ? item.source.trim() : "";
  return requireFavoriteKey(source, id, label);
}

export function requireFavoriteKey(source: unknown, id: unknown, label: string) {
  const normalizedSource = typeof source === "string" ? source.trim() : "";
  const normalizedId = typeof id === "string" ? id.trim() : "";
  if (!normalizedId || !isPlaylistSource(normalizedSource)) {
    throw new Error(`${label}收藏需要 source 和 id`);
  }
  return { id: normalizedId, source: normalizedSource as PlaylistSource };
}

export function normalizePlaylistSnapshot(input: Partial<PlaylistSnapshot> | Record<string, unknown>): PlaylistSnapshot {
  const { id, source } = requireFavoriteIdentity(input, "歌单");
  const playlist: PlaylistSnapshot = {
    id,
    source,
    name: toStringValue(input.name),
    desc: toStringValue(input.desc),
    cover: toStringValue(input.cover),
    tags: normalizePlaylistTags(input.tags),
  };

  const coverSize = normalizeCoverSize(input.coverSize);
  if (coverSize) playlist.coverSize = coverSize;

  const songCount = normalizeCount(input.song_count);
  if (songCount !== undefined) playlist.song_count = songCount;

  const playCount = normalizeCount(input.play_count);
  if (playCount !== undefined) playlist.play_count = playCount;

  const collectCount = normalizeCount(input.collect_count);
  if (collectCount !== undefined) playlist.collect_count = collectCount;

  return playlist;
}

export function normalizePlaylistSource(source: unknown) {
  const normalizedSource = typeof source === "string" ? source.trim() : "";
  if (isPlaylistSource(normalizedSource)) return normalizedSource;
  return "kg";
}

export function isPlaylistSource(source: string): source is PlaylistSource {
  return source === "kg" || source === "wy" || source === "kw" || source === "qq" || source === "local";
}

export function normalizeCoverSize(value: unknown): PlaylistSnapshot["coverSize"] | undefined {
  if (!isRecord(value)) return undefined;
  return {
    s: toStringValue(value.s),
    m: toStringValue(value.m),
    l: toStringValue(value.l),
    xl: toStringValue(value.xl),
  };
}

export function normalizePlaylistTags(value: unknown): PlaylistSnapshot["tags"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is Record<string, unknown> => isRecord(tag))
    .map((tag) => ({
      name: toStringValue(tag.name),
      id: toStringValue(tag.id),
    }))
    .filter((tag) => tag.name || tag.id);
}

export function normalizeCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  return undefined;
}

export function toStringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeTrackSnapshot(input: TrackSnapshot | Record<string, unknown>): TrackSnapshot {
  const id = toStringValue(input.id);
  const source = toStringValue(input.source);
  if (!id || !source) {
    throw new Error("歌曲收藏需要 source 和 id");
  }

  const track: TrackSnapshot = {
    id,
    source,
    name: toStringValue(input.name),
    singer: toStringValue(input.singer),
    album: toStringValue(input.album),
    cover: toStringValue(input.cover),
    duration: normalizeDuration(input.duration),
  };

  const urlParam = toStringValue(input.urlParam);
  if (urlParam) track.urlParam = urlParam;

  const coverSize = normalizeCoverSize(input.coverSize);
  if (coverSize) track.coverSize = coverSize;

  const size = normalizeTrackSize(input.size);
  if (size) track.size = size;

  const dCover = toStringValue(input.d_cover);
  if (dCover) track.d_cover = dCover;

  const lyric = toStringValue(input.lyric);
  if (lyric) track.lyric = lyric;

  const krc = toStringValue(input.krc);
  if (krc) track.krc = krc;

  if (typeof input.vip === "boolean") track.vip = input.vip;

  const filePath = toStringValue(input.filePath);
  if (filePath) track.filePath = filePath;

  return track;
}

export function normalizeTrackSize(value: unknown) {
  if (!isRecord(value)) return undefined;
  const size: Record<string, number> = {};
  Object.entries(value).forEach(([key, rawValue]) => {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      size[key] = rawValue;
    }
  });
  return Object.keys(size).length ? size : undefined;
}

export function normalizeDuration(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const duration = Number(value);
    if (Number.isFinite(duration)) return duration;
  }
  return 0;
}
