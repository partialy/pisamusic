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

export type PlayableTrackPayload = {
  source: MusicSource;
  urlParam?: string;
  id?: string;
  quality?: string;
  br?: number;
};
