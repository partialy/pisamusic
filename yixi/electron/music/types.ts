export type MusicSource = "kg" | "wy" | "kw";

export type MusicSearchParams = {
  source: MusicSource;
  keywords: string;
  page?: number;
  pageSize?: number;
};

export type MusicSuggestParams = {
  source?: "wy";
  keywords: string;
};

export type PlaylistSearchParams = {
  source: Exclude<MusicSource, "kw">;
  keywords: string;
  page?: number;
  pageSize?: number;
};

export type TopPlaylistParams = {
  source: "kg";
  categoryId?: string | number;
  page?: number;
  pageSize?: number;
};

export type PlaylistDetailParams = {
  source: Exclude<MusicSource, "kw">;
  id: string;
};

export type PlaylistTracksParams = {
  source: Exclude<MusicSource, "kw">;
  id: string;
  page?: number;
  pageSize?: number;
};

export type MusicUrlParams = {
  source: MusicSource;
  id: string;
  quality?: string;
  br?: number;
};

export type MusicLyricParams = {
  source: MusicSource;
  id?: string;
  hash?: string;
};

export type MusicLyricResult = {
  krc: string;
  lrc: string;
};

export type PlayableTrackPayload = {
  source: MusicSource;
  urlParam?: string;
  id?: string;
  quality?: string;
  br?: number;
};
