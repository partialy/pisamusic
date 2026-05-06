import type { TrackSearchResult } from "./music";

export interface SearchHistoryItem {
  keyword: string;
  createdAt: number;
}

export interface PlayHistoryItem {
  track: TrackSearchResult;
  playedAt: number;
}

export interface QueueSnapshot {
  queue: TrackSearchResult[];
  currentIndex: number;
  updatedAt: number;
}
