export type MediaCacheTrack = {
  source: "kg" | "wy" | "kw" | "local";
  id?: string;
  urlParam?: string;
  filePath?: string;
  qualityKey?: string;
  quality?: string;
  br?: number;
  level?: string;
};

export type MediaCachePolicy = {
  enabled: boolean;
  configuredDirectory: string;
  directory: string;
  limitBytes: number;
  fallbackDirectory: boolean;
};

export type MediaCacheStatus = {
  enabled: boolean;
  directory: string;
  limitBytes: number;
  usedBytes: number;
  entryCount: number;
  readyCount: number;
  writingCount: number;
  fallbackDirectory: boolean;
};

export type MediaCacheEntryStatus = "partial" | "ready";

export type MediaCacheEntry = {
  cacheKey: string;
  source: string;
  songId: string;
  qualityKey: string;
  totalBytes: number;
  cachedBytes: number;
  mimeType: string;
  status: MediaCacheEntryStatus;
  hitCount: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type MediaCacheSegment = {
  id: number;
  cacheKey: string;
  startByte: number;
  endByte: number;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  lastAccessedAt: string;
};

export type ByteRange = {
  start: number;
  end: number | null;
};

export type ParsedContentRange = {
  start: number;
  end: number;
  total: number | null;
};

export type MediaCacheRepositoryStats = {
  usedBytes: number;
  entryCount: number;
  readyCount: number;
};

export type MediaCacheDescriptor = {
  cacheKey: string;
  track: MediaCacheTrack;
  originUrl: string;
  originResolvedAt: number;
};
