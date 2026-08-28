import type { Song } from "./song";

export interface CloudMusicSummary {
  total: number;
  latestUpdatedAt: number | null;
}

export interface CloudMusicTrackDto {
  uuid: string;
  source: "cloud";
  title: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  format: string;
  playable: boolean;
  cover: {
    source: "uploaded" | "embedded" | "default";
    url: string;
  };
  lyrics: {
    format: "lrc" | "txt";
    fileName: string;
  } | null;
  createdAt: number;
  updatedAt: number;
}

export interface CloudMusicSearchResult {
  source: "cloud";
  items: CloudMusicTrackDto[];
  total: number;
  offset: number;
  limit: number;
}

export interface CloudMusicResourceUrl {
  uuid: string;
  source: "cloud";
  url: string;
  expiresAt: number;
  format?: "lrc" | "txt";
}

export function toCloudSong(track: CloudMusicTrackDto): Song {
  return {
    id: track.uuid,
    urlParam: track.uuid,
    source: "cloud",
    name: track.title,
    singer: track.artist,
    album: track.album ?? "",
    duration: track.durationMs ?? 0,
    cover: track.cover.url,
    playable: track.playable,
  };
}
