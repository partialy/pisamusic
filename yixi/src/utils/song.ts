import type { Song } from "@/types/song";

type SongSource = Song["source"];
type SongInput = Record<string, unknown> | Partial<Song> | null | undefined;

const songSources: SongSource[] = ["kg", "qq", "wy", "kw", "local"];

export function normalizeSong(input: SongInput): Song {
  const raw = (input ?? {}) as Record<string, unknown>;
  const id = toStringValue(raw.id);
  const source = normalizeSource(raw.source);

  if (!id || !source) {
    throw new Error("歌曲收藏失败：缺少来源或 ID");
  }

  const song: Song = {
    id,
    source,
    urlParam: toStringValue(raw.urlParam) || id,
    name: toStringValue(raw.name),
    singer: toStringValue(raw.singer),
    album: toStringValue(raw.album),
    cover: toStringValue(raw.cover),
    duration: normalizeDuration(raw.duration),
  };

  const coverSize = normalizeCoverSize(raw.coverSize);
  if (coverSize) song.coverSize = coverSize;

  const size = normalizeSize(raw.size);
  if (size) song.size = size;

  const dCover = toStringValue(raw.d_cover);
  if (dCover) song.d_cover = dCover;

  const lyric = toStringValue(raw.lyric);
  if (lyric) song.lyric = lyric;

  const krc = toStringValue(raw.krc);
  if (krc) song.krc = krc;

  if (typeof raw.vip === "boolean") song.vip = raw.vip;

  const filePath = toStringValue(raw.filePath);
  if (filePath) song.filePath = filePath;

  return song;
}

export function hasSongIdentity(input: SongInput) {
  const raw = (input ?? {}) as Record<string, unknown>;
  return Boolean(toStringValue(raw.id) && normalizeSource(raw.source));
}

function normalizeSource(value: unknown): SongSource | "" {
  if (typeof value !== "string") return "";
  const source = value.trim() as SongSource;
  return songSources.includes(source) ? source : "";
}

function normalizeCoverSize(value: unknown): Song["coverSize"] | undefined {
  if (!isRecord(value)) return undefined;
  return {
    s: toStringValue(value.s),
    m: toStringValue(value.m),
    l: toStringValue(value.l),
    xl: toStringValue(value.xl),
  };
}

function normalizeSize(value: unknown): Song["size"] | undefined {
  if (!isRecord(value)) return undefined;
  const size: NonNullable<Song["size"]> = {};
  Object.entries(value).forEach(([key, rawValue]) => {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      size[key] = rawValue;
    }
  });
  return Object.keys(size).length ? size : undefined;
}

function normalizeDuration(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const duration = Number(value);
    if (Number.isFinite(duration)) return duration;
  }
  return 0;
}

function toStringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
