
type SongCoverInput = {
  source?: string;
  cover?: string;
  coverSize?: unknown;
  picUrl?: string;
  coverUrl?: string;
  coverImgUrl?: string;
  imgurl?: string;
  img1v1Url?: string;
  album?: unknown;
  al?: unknown;
};

export const COVER_SIZES = [1024, 720, 480, 240] as const;
export function normalizeCoverSize(size = 240) {
  return size <= 240 ? 240 : size <= 480 ? 480 : size <= 720 ? 720 : 1024;
}
// 仅识别已知 CDN 尺寸段，写入时保留模板，不迁移历史库。
export function normalizeCoverOriginal(source: string | undefined, url = ""): string {
  if (source !== "kg" || !url || url.includes("{size}")) return url;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)(kugou\.com|kgimg\.com)$/i.test(parsed.hostname)) return url;
    return url.replace(/(\/(?:stdmusic(?:\/album)?|soft\/collection|custom|music))\/\d+(?=\/)/, "$1/{size}");
  } catch { return url; }
}

export function getKgImageUrl(url?: string, size = 240, fallback = "") {
  if (!url) return fallback;
  return normalizeCoverOriginal("kg", url).split("{size}").join(String(normalizeCoverSize(size)));
}

export function getWyCoverSizeUrl(url?: string, size: number | null = null, fallback = "") {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)(music\.126\.net|music\.163\.com|126\.net)$/i.test(parsed.hostname)) return url;
    parsed.protocol = "https:";
    if (size) {
      const pixels = normalizeCoverSize(size);
      parsed.searchParams.delete("thumbnail");
      parsed.searchParams.set("param", `${pixels}y${pixels}`);
    }
    return parsed.toString();
  } catch { return url; }
}
export function getWyCoverUrl(item: SongCoverInput, fallback = "") {
  const album = asRecord(item.album);
  const al = asRecord(item.al);
  const legacy = asRecord(item.coverSize);
  const cover = item.cover || item.picUrl || item.coverUrl || item.coverImgUrl || item.imgurl || item.img1v1Url ||
    toStringValue(album?.picUrl) || toStringValue(al?.picUrl) || toStringValue(asRecord(al?.xInfo)?.picUrl) ||
    toStringValue(legacy?.xl) || toStringValue(legacy?.l) || toStringValue(legacy?.m) || toStringValue(legacy?.s);
  return {
    cover: cover || fallback,
    coverSize: {
      s: getWyCoverSizeUrl(cover, 240, fallback),
      m: getWyCoverSizeUrl(cover, 480, fallback),
      l: getWyCoverSizeUrl(cover, 720, fallback),
      xl: getWyCoverSizeUrl(cover, 1024, fallback),
    },
  };
}
export function getSongCoverUrl(song: SongCoverInput, size = 240, fallback = "") {
  if (song.source === "local") return fallback;
  const legacy = asRecord(song.coverSize);
  const cover = song.cover || toStringValue(legacy?.xl) || toStringValue(legacy?.l) || toStringValue(legacy?.m) || toStringValue(legacy?.s);
  if (song.source === "kg") return getKgImageUrl(cover, size, fallback);
  if (song.source === "wy") return getWyCoverSizeUrl(getWyCoverUrl(song).cover, size, fallback);
  return cover || fallback;
}
export function getSongCoverCandidates(song: SongCoverInput, size = 1024): string[] {
  const candidates = COVER_SIZES.filter(value => value <= normalizeCoverSize(size))
    .map(value => getSongCoverUrl(song, value));
  const original = song.source === "wy" ? getWyCoverUrl(song).cover : song.cover;
  if (original && !original.includes("{size}")) candidates.push(original);
  return [...new Set(candidates.filter(Boolean))];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function toStringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}
