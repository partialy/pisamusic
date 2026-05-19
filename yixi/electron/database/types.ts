export type SettingRecord<T = unknown> = {
  key: string;
  value: T;
  version: number;
  updatedAt: string;
};

export type TrackSnapshot = {
  id: string;
  source: "kg" | "wy" | "kw" | string;
  name?: string;
  singer?: string;
  album?: string;
  cover?: string;
  duration?: number;
  filePath?: string;
  [key: string]: unknown;
};

export type LocalSongItem = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  filePath: string;
  directory: string;
  fileName: string;
  extension: string;
  size: number;
  mtimeMs: number;
  payload: TrackSnapshot;
  updatedAt: string;
};

export type LocalLibraryScanMeta = {
  fingerprint: string;
  directories: string[];
  totalFiles: number;
  scannedAt: string;
};

export type DownloadMetadataStatus = "embedded" | "sidecar" | "failed";
export type DownloadRecordStatus = "queued" | "running" | "completed" | "failed";

export type DownloadRecordInput = {
  source: string;
  songId: string;
  qualityKey: string;
  status: DownloadRecordStatus;
  downloadDirectory: string;
  filePath?: string;
  cachePath?: string;
  metadataStatus: DownloadMetadataStatus;
  metadataJsonPath?: string;
  lyricPath?: string;
  coverPath?: string;
  totalBytes?: number;
  receivedBytes?: number;
  completedAt?: string;
  payload: TrackSnapshot;
  message?: string;
};

export type DownloadRecordItem = DownloadRecordInput & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export type SearchHistoryItem = {
  id: number;
  keyword: string;
  source: string | null;
  createdAt: string;
};

export type PlayHistoryItem = {
  id: number;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload: TrackSnapshot;
  playedAt: string;
};

export type QueueSnapshot = {
  currentIndex: number;
  queue: TrackSnapshot[];
  updatedAt: string;
};

export type PlaylistSource = "kg" | "wy" | "kw" | "qq" | "local";

export type PlaylistSnapshot = {
  id: string;
  source: PlaylistSource;
  name: string;
  desc: string;
  cover: string;
  coverSize?: {
    s: string;
    m: string;
    l: string;
    xl: string;
  };
  tags: {
    name: string;
    id: string;
  }[];
  song_count?: number | string;
  play_count?: number | string;
  collect_count?: number | string;
};

export type FavoriteSongItem = {
  favoriteKey: string;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload: TrackSnapshot;
  createdAt: string;
};

export type FavoritePlaylistItem = {
  favoriteKey: string;
  playlistId: string;
  source: string;
  name: string;
  description: string;
  artwork: string;
  songCount: string;
  playCount: string;
  collectCount: string;
  payload: PlaylistSnapshot;
  createdAt: string;
};

export type UserPlaylistItem = {
  playlistKey: string;
  playlistId: string;
  source: PlaylistSource;
  name: string;
  description: string;
  artwork: string;
  songCount: string;
  playCount: string;
  collectCount: string;
  payload: PlaylistSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type UserPlaylistTrackItem = {
  playlistId: string;
  trackKey: string;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload: TrackSnapshot;
  createdAt: string;
};

export type UserCloudSongItem = {
  cloudSource: string;
  trackKey: string;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload: TrackSnapshot;
  updatedAt: string;
};

export type NetworkErrorRecordInput = {
  requestScope: "system" | "gateway";
  method: string;
  requestUrl: string;
  requestPath: string;
  requestParams?: unknown;
  httpStatus?: number | null;
  businessCode?: number | string | null;
  response?: unknown;
  errorMessage: string;
};

export type NetworkErrorRecordSummary = {
  id: number;
  requestScope: string;
  method: string;
  requestPath: string;
  httpStatus: number | null;
  businessCode: string | null;
  errorMessage: string;
  createdAt: string;
};

export type NetworkErrorRecordDetail = NetworkErrorRecordSummary & {
  requestUrl: string;
  requestParams: unknown;
  response: unknown;
};

export type NetworkErrorRecordPage = {
  items: NetworkErrorRecordSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type SettingRow = {
  key: string;
  value_json: string;
  version: number;
  updated_at: string;
};

export type SearchHistoryRow = {
  id: number;
  keyword: string;
  source: string | null;
  created_at: string;
};

export type PlayHistoryRow = {
  id: number;
  track_id: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload_json: string;
  played_at: string;
};

export type QueueSnapshotRow = {
  current_index: number;
  queue_json: string;
  updated_at: string;
};

export type FavoriteSongRow = {
  favorite_key: string;
  track_id: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload_json: string;
  created_at: string;
};

export type FavoritePlaylistRow = {
  favorite_key: string;
  playlist_id: string;
  source: string;
  name: string;
  description: string;
  artwork: string;
  song_count: string;
  play_count: string;
  collect_count: string;
  payload_json: string;
  created_at: string;
};

export type UserPlaylistRow = {
  playlist_key: string;
  playlist_id: string;
  source: string;
  name: string;
  description: string;
  artwork: string;
  song_count: string;
  play_count: string;
  collect_count: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

export type UserPlaylistTrackRow = {
  playlist_id: string;
  track_key: string;
  track_id: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload_json: string;
  created_at: string;
};

export type UserCloudSongRow = {
  cloud_source: string;
  track_key: string;
  track_id: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload_json: string;
  updated_at: string;
};

export type LocalSongRow = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  file_path: string;
  directory: string;
  file_name: string;
  extension: string;
  size: number;
  mtime_ms: number;
  payload_json: string;
  updated_at: string;
};

export type LocalLibraryScanMetaRow = {
  id: number;
  fingerprint: string;
  directories_json: string;
  total_files: number;
  scanned_at: string;
};

export type DownloadRecordRow = {
  id: number;
  source: string;
  song_id: string;
  quality_key: string;
  status: DownloadRecordStatus;
  download_directory: string;
  file_path: string;
  cache_path: string;
  metadata_status: DownloadMetadataStatus;
  metadata_json_path: string;
  lyric_path: string;
  cover_path: string;
  total_bytes: number;
  received_bytes: number;
  payload_json: string;
  message: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
};

export type NetworkErrorSummaryRow = {
  id: number;
  request_scope: string;
  method: string;
  request_path: string;
  http_status: number | null;
  business_code: string | null;
  error_message: string;
  created_at: string;
};

export type NetworkErrorDetailRow = NetworkErrorSummaryRow & {
  request_url: string;
  request_params_json: string;
  response_json: string;
};
