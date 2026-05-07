export type MusicSource = "kg" | "wy" | "kw";

export type MusicSearchParams = {
  source: MusicSource;
  keywords: string;
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
