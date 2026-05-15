import type { Song } from "@/types/song";

export type WyCloudSongResult = {
  songs: Song[];
  total: number;
  hasMore: boolean;
};

export function convertWyCloudSongs(response: unknown): WyCloudSongResult {
  const root = toRecord(response);
  const items = toArray(root.data);

  return {
    songs: items.map(convertWyCloudSong),
    total: numberValue(root.count),
    hasMore: Boolean(root.hasMore),
  };
}

function convertWyCloudSong(item: unknown): Song {
  const raw = toRecord(item);
  const simpleSong = toRecord(raw.simpleSong);
  const album = toRecord(simpleSong.al);
  const privateCloud = toRecord(raw.privateCloud);

  const id = scalar(simpleSong.id) || scalar(raw.songId) || scalar(privateCloud.songId);
  const name = scalar(simpleSong.name) || scalar(raw.songName) || scalar(privateCloud.song);
  const singer = convertArtists(simpleSong.ar) || scalar(raw.artist) || scalar(privateCloud.artist);
  const albumName = scalar(album.name) || scalar(raw.album) || scalar(privateCloud.album);
  const duration = numberValue(simpleSong.dt);
  const fee = numberValue(simpleSong.fee);
  const fileSize = numberValue(raw.fileSize || privateCloud.fileSize);

  return {
    id,
    urlParam: id,
    name,
    singer,
    album: albumName,
    cover: scalar(album.picUrl),
    duration,
    size: fileSize ? { size: fileSize } : undefined,
    url: "",
    source: "wy",
    vip: fee === 1 || fee === 4 || fee === 8,
  };
}

function convertArtists(value: unknown) {
  return toArray(value)
    .map((item) => scalar(toRecord(item).name))
    .filter(Boolean)
    .join("、");
}

function scalar(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
