import { publicPlaylist, publicTrack } from "../database/accountLibraryPolicy";
import type { AccountLibraryRepository } from "../database/accountLibraryRepository";
import type { TrackSnapshot } from "../database/types";
import { LOCAL_SYNC_ID, createLocalTrackResolver } from "../localLibrary/localTrackAccess";
export function logicalTrackId(repo: AccountLibraryRepository, track: TrackSnapshot) {
  if (track.source !== "local" || LOCAL_SYNC_ID.test(track.id)) return track.id;
  return repo.identities.find(`local:${track.id}`)?.sync_track_id ?? repo.identities.ensure(`local:${track.id}`, repo.scope.deviceIdentity).sync_track_id;
}
export function seedAccountLibrary(repo: AccountLibraryRepository) {
  const prepareTrack = createLocalTrackResolver(repo);
  const enqueue = (itemType: string, itemKey: string, payload: unknown) => {
    // 重新 seed 不覆盖尚未 ACK 的删除或更新。
    if (!repo.listPendingSyncKeys().some(row => row.item_type === itemType && row.item_key === itemKey)) repo.enqueueSyncOp({ itemType, itemKey, action: "upsert", payload });
  };
  repo.listFavoriteSongs().filter(item => item.source !== "local").forEach(item => enqueue("favorite_song", item.favoriteKey, publicTrack(item.payload)));
  repo.listFavoritePlaylists().forEach(item => enqueue("favorite_playlist", item.favoriteKey, publicPlaylist(item.payload)));
  repo.listUserPlaylists("local").forEach(item => {
    enqueue("user_playlist", item.playlistKey, publicPlaylist(item.payload));
    repo.listUserPlaylistTracks(item.playlistId).forEach(track => {
      const id = logicalTrackId(repo, track.payload);
      enqueue("playlist_track", `${item.playlistId}|${track.source}:${id}`, { ...publicTrack(prepareTrack(track.payload), id), sortOrder: track.sortOrder });
    });
  });
}
export function syncPayload(itemType: string, payload: unknown) {
  const value = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const fields = itemType === "favorite_song" || itemType === "playlist_track"
    ? ["id", "source", "urlParam", "name", "singer", "album", "cover", "duration", "durationMs", "favoritedAt", ...(itemType === "playlist_track" ? ["sortOrder"] : [])]
    : ["id", "source", "name", "desc", "cover", "tags", "song_count", "play_count", "collect_count", ...(itemType === "user_playlist" ? ["coverResource", "coverPreset"] : [])];
  return Object.fromEntries(fields.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
}
