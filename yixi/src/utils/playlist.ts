import type { CommonPlaylist } from "@/types/song";

type PlaylistSource = CommonPlaylist["source"];
type CountValue = number | string;
type PlaylistInput = Record<string, unknown> | Partial<CommonPlaylist> | null | undefined;

const playlistSources: PlaylistSource[] = ["kg", "qq", "wy", "kw", "local"];

export function normalizePlaylist(input: PlaylistInput): CommonPlaylist {
  const raw = (input ?? {}) as Record<string, unknown>;
  const id = toStringValue(raw.id);
  const source = normalizeSource(raw.source);

  if (!id || !source) {
    throw new Error("歌单收藏失败：缺少来源或 ID");
  }

  const playlist: CommonPlaylist = {
    id,
    source,
    name: toStringValue(raw.name),
    desc: toStringValue(raw.desc),
    cover: toStringValue(raw.cover),
    tags: normalizeTags(raw.tags),
  };

  const coverSize = normalizeCoverSize(raw.coverSize);
  if (coverSize) playlist.coverSize = coverSize;

  const songCount = normalizeCount(raw.song_count);
  if (songCount !== undefined) playlist.song_count = songCount;

  const playCount = normalizeCount(raw.play_count);
  if (playCount !== undefined) playlist.play_count = playCount;

  const collectCount = normalizeCount(raw.collect_count);
  if (collectCount !== undefined) playlist.collect_count = collectCount;

  return playlist;
}

export function normalizePlaylistList(items: PlaylistInput[]): CommonPlaylist[] {
  return items.map((item) => normalizePlaylist(item));
}

export function hasPlaylistIdentity(input: PlaylistInput) {
  const raw = (input ?? {}) as Record<string, unknown>;
  return Boolean(toStringValue(raw.id) && normalizeSource(raw.source));
}

export function assertPlaylistIdentity(input: PlaylistInput) {
  if (!hasPlaylistIdentity(input)) {
    throw new Error("歌单收藏失败：缺少来源或 ID");
  }
}

function normalizeSource(value: unknown): PlaylistSource | "" {
  if (typeof value !== "string") return "";
  const source = value.trim() as PlaylistSource;
  return playlistSources.includes(source) ? source : "";
}

function normalizeCoverSize(value: unknown): CommonPlaylist["coverSize"] | undefined {
  if (!isRecord(value)) return undefined;
  return {
    s: toStringValue(value.s),
    m: toStringValue(value.m),
    l: toStringValue(value.l),
    xl: toStringValue(value.xl),
  };
}

function normalizeTags(value: unknown): CommonPlaylist["tags"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((tag) => ({
      name: toStringValue(tag.name),
      id: toStringValue(tag.id),
    }))
    .filter((tag) => tag.name || tag.id);
}

function normalizeCount(value: unknown): CountValue | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  return undefined;
}

function toStringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
