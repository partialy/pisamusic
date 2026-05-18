export type SongCoverSize = 120 | 240 | 360 | 480;

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

export function getKgImageUrl(url?: string, size: SongCoverSize = 120, fallback = ""): string {
  if (!url) return fallback;
  return url.replace("{size}", size.toString());
}

export function getWyCoverSizeUrl(url?: string, size: number | null = null, fallback = "") {
  try {
    if (!url) return fallback;
    const sizeUrl = size
      ? typeof size === "number"
        ? `?param=${size}y${size}`
        : `?param=${size}`
      : "";
    const imageUrl = url.replace(/^http:/, "https:");
    if (imageUrl.endsWith(".jpg")) {
      return imageUrl + sizeUrl;
    }
    if (imageUrl.endsWith("&")) {
      const nextUrl = imageUrl + "cl";
      return nextUrl.replace(
        /(thumbnail=[0-9]+y[0-9]+&cl)/,
        `thumbnail=${size}y${size}&`
      );
    }
    return imageUrl;
  } catch (error) {
    console.error("图片链接处理出错：", error);
    return fallback;
  }
}

export function getWyCoverUrl(item: SongCoverInput, fallback = "") {
  const album = asRecord(item.album);
  const al = asRecord(item.al);
  const alXInfo = asRecord(al?.xInfo);
  const cover =
    item.cover ||
    item.picUrl ||
    item.coverUrl ||
    item.coverImgUrl ||
    item.imgurl ||
    item.img1v1Url ||
    toStringValue(album?.picUrl) ||
    toStringValue(al?.picUrl) ||
    toStringValue(alXInfo?.picUrl);
  const coverSize = {
    s: getWyCoverSizeUrl(cover, 100, fallback),
    m: getWyCoverSizeUrl(cover, 300, fallback),
    l: getWyCoverSizeUrl(cover, 1024, fallback),
    xl: getWyCoverSizeUrl(cover, 1920, fallback),
  };
  return { cover: cover || fallback, coverSize };
}

export function getSongCoverUrl(song: SongCoverInput, size: SongCoverSize = 120, fallback = "") {
  if (song.source === "local") return fallback;
  if (song.source === "kg") return getKgImageUrl(song.cover, size, fallback);
  if (song.source === "wy") {
    const res = getWyCoverUrl(song, fallback);
    switch (size) {
      case 120:
        return res.coverSize.s || res.cover || fallback;
      case 240:
        return res.coverSize.m || res.cover || fallback;
      case 360:
        return res.coverSize.l || res.cover || fallback;
      case 480:
        return res.coverSize.xl || res.cover || fallback;
    }
  }
  return song.cover || fallback;
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
