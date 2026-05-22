export type MusicSource = "kg" | "wy" | "kw";
export type PlayableMusicSource = MusicSource | "local";

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

export type PlaylistTagsParams = {
  source: "kg" | "wy";
};

export type TopPlaylistParams = {
  source: "kg" | "wy";
  categoryId?: string | number;
  cat?: string;
  order?: "hot" | "new";
  page?: number;
  pageSize?: number;
};

export type TopSongsParams = {
  source: "kg";
};

export type WyPersonalizedPlaylistParams = {
  limit?: number;
};

export type WyPersonalizedNewSongParams = {
  limit?: number;
};

export type PlaylistDetailParams = {
  source: Exclude<MusicSource, "kw">;
  id: string;
};

export type PlaylistTracksParams = {
  source: Exclude<MusicSource, "kw">;
  id: string;
  offset?: number;
  page?: number;
  pageSize?: number;
};

export type DynamicCoverParams = {
  source: "wy";
  id: string | number;
};

export type MusicUrlParams = {
  source: MusicSource;
  id: string;
  qualityKey?: string;
  quality?: string;
  br?: number;
  level?: string;
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
  source: PlayableMusicSource;
  urlParam?: string;
  id?: string;
  filePath?: string;
  qualityKey?: string;
  quality?: string;
  br?: number;
  level?: string;
};
