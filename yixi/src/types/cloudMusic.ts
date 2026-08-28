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
  status?: string;
  statusReason?: string;
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

export interface CloudMusicAssetUploadTicket {
  assetId: string;
  fileRecordId: string;
  kind: "audio" | "cover-uploaded" | "lyrics";
  key: string;
  uploadToken: string;
  uploadUrl: string;
}

export interface CloudMusicUploadSession {
  track: CloudMusicTrackDto;
  tickets: CloudMusicAssetUploadTicket[];
}

export interface CloudMusicUploadSessionRequest {
  audio: {
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
  cover?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
  lyrics?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
}

export interface CloudMusicAssetReserveRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  kind: "cover-uploaded" | "lyrics";
}

export interface CloudMusicUserSubmitInput {
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
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
