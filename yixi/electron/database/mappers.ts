import { parseJson } from "./json";
import { normalizePlaylistSnapshot, normalizePlaylistSource, normalizeTrackSnapshot } from "./normalizers";
import type {
  DownloadRecordItem,
  DownloadRecordRow,
  FavoritePlaylistItem,
  FavoritePlaylistRow,
  FavoriteSongItem,
  FavoriteSongRow,
  LocalSongItem,
  LocalSongRow,
  NetworkErrorDetailRow,
  NetworkErrorRecordDetail,
  NetworkErrorRecordSummary,
  NetworkErrorSummaryRow,
  PlaylistSnapshot,
  TrackSnapshot,
  UserCloudSongItem,
  UserCloudSongRow,
  UserPlaylistItem,
  UserPlaylistRow,
  UserPlaylistTrackItem,
  UserPlaylistTrackRow,
} from "./types";

export function toNetworkErrorSummary(row: NetworkErrorSummaryRow): NetworkErrorRecordSummary {
  return {
    id: row.id,
    requestScope: row.request_scope,
    method: row.method,
    requestPath: row.request_path,
    httpStatus: row.http_status,
    businessCode: row.business_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export function toNetworkErrorDetail(row: NetworkErrorDetailRow): NetworkErrorRecordDetail {
  return {
    ...toNetworkErrorSummary(row),
    requestUrl: row.request_url,
    requestParams: parseJson<unknown>(row.request_params_json, null),
    response: parseJson<unknown>(row.response_json, null),
  };
}

export function toDownloadRecord(row: DownloadRecordRow): DownloadRecordItem {
  return {
    id: row.id,
    source: row.source,
    songId: row.song_id,
    qualityKey: row.quality_key,
    status: row.status,
    downloadDirectory: row.download_directory,
    filePath: row.file_path,
    cachePath: row.cache_path,
    metadataStatus: row.metadata_status,
    metadataJsonPath: row.metadata_json_path,
    lyricPath: row.lyric_path,
    coverPath: row.cover_path,
    totalBytes: row.total_bytes,
    receivedBytes: row.received_bytes,
    payload: parseJson<TrackSnapshot>(row.payload_json, {
      id: row.song_id,
      source: row.source,
    }),
    message: row.message,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toUserPlaylist(row: UserPlaylistRow): UserPlaylistItem {
  const payload = normalizePlaylistSnapshot(
    parseJson<Partial<PlaylistSnapshot>>(row.payload_json, {
      id: row.playlist_id,
      source: normalizePlaylistSource(row.source),
    })
  );
  return {
    playlistKey: row.playlist_key,
    playlistId: row.playlist_id,
    source: normalizePlaylistSource(row.source),
    name: row.name,
    description: row.description,
    artwork: row.artwork,
    songCount: row.song_count,
    playCount: row.play_count,
    collectCount: row.collect_count,
    payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toUserPlaylistTrack(row: UserPlaylistTrackRow): UserPlaylistTrackItem {
  const payload = normalizeTrackSnapshot(
    parseJson<TrackSnapshot>(row.payload_json, {
      id: row.track_id,
      source: row.source,
    })
  );
  return {
    playlistId: row.playlist_id,
    trackKey: row.track_key,
    trackId: row.track_id,
    source: row.source,
    title: row.title,
    artist: row.artist,
    album: row.album,
    artwork: row.artwork,
    duration: row.duration,
    payload,
    createdAt: row.created_at,
  };
}

export function toUserCloudSong(row: UserCloudSongRow): UserCloudSongItem {
  const payload = normalizeTrackSnapshot(
    parseJson<TrackSnapshot>(row.payload_json, {
      id: row.track_id,
      source: row.source,
    })
  );
  return {
    cloudSource: row.cloud_source,
    trackKey: row.track_key,
    trackId: row.track_id,
    source: row.source,
    title: row.title,
    artist: row.artist,
    album: row.album,
    artwork: row.artwork,
    duration: row.duration,
    payload,
    updatedAt: row.updated_at,
  };
}

export function toFavoriteSong(row: FavoriteSongRow): FavoriteSongItem {
  const payload = normalizeTrackSnapshot(
    parseJson<TrackSnapshot>(row.payload_json, {
      id: row.track_id,
      source: row.source,
    })
  );
  return {
    favoriteKey: row.favorite_key,
    trackId: row.track_id,
    source: row.source,
    title: row.title,
    artist: row.artist,
    album: row.album,
    artwork: row.artwork,
    duration: row.duration,
    payload,
    createdAt: row.created_at,
  };
}

export function toFavoritePlaylist(row: FavoritePlaylistRow): FavoritePlaylistItem {
  const payload = normalizePlaylistSnapshot(
    parseJson<Partial<PlaylistSnapshot>>(row.payload_json, {
      id: row.playlist_id,
      source: normalizePlaylistSource(row.source),
    })
  );
  return {
    favoriteKey: row.favorite_key,
    playlistId: row.playlist_id,
    source: row.source,
    name: row.name,
    description: row.description,
    artwork: row.artwork,
    songCount: row.song_count,
    playCount: row.play_count,
    collectCount: row.collect_count,
    payload,
    createdAt: row.created_at,
  };
}

export function toLocalSong(row: LocalSongRow): LocalSongItem {
  const payload = normalizeTrackSnapshot(
    parseJson<TrackSnapshot>(row.payload_json, {
      id: row.id,
      source: "local",
      urlParam: row.file_path,
      filePath: row.file_path,
    })
  );
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    filePath: row.file_path,
    directory: row.directory,
    fileName: row.file_name,
    extension: row.extension,
    size: row.size,
    mtimeMs: row.mtime_ms,
    payload,
    updatedAt: row.updated_at,
  };
}
