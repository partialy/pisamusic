export type MusicSource = "kg" | "wy" | "kw";

export type SourceGroupedResult = Record<MusicSource, TrackSearchResult[]>;

export interface TrackSearchResult {
  id: string;
  source: MusicSource;
  sourceName: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  duration: number;
  quality?: string;
  raw?: unknown;
}

export interface PlayUrlResult {
  url: string;
  quality?: string;
  ext?: string;
}

export interface LyricResult {
  trackId: string;
  source: MusicSource;
  text: string;
}

export interface SearchRequest {
  keyword: string;
  page?: number;
  pageSize?: number;
  sources?: MusicSource[];
}

export interface ResolveUrlRequest {
  track: TrackSearchResult;
}

export interface LyricRequest {
  track: TrackSearchResult;
}

export const MUSIC_SOURCE_LABEL: Record<MusicSource, string> = {
  kg: "酷狗",
  wy: "网易云",
  kw: "酷我",
};
