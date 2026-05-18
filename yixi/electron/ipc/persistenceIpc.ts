import { BrowserWindow, ipcMain } from "electron";
import { getAppDatabase } from "../database";
import type { PlaylistSnapshot, PlaylistSource, QueueSnapshot, TrackSnapshot } from "../database/appDatabase";

let registered = false;

type QueueSnapshotInput = Pick<QueueSnapshot, "currentIndex" | "queue">;

export function setupPersistenceIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("settings:get", (_event, key: string) => {
    return getAppDatabase().getSetting(key);
  });

  ipcMain.handle(
    "settings:set",
    (_event, payload: { key: string; value: unknown; version?: number }) => {
      return getAppDatabase().setSetting(payload.key, payload.value, payload.version);
    }
  );

  ipcMain.handle("settings:delete", (_event, key: string) => {
    return getAppDatabase().deleteSetting(key);
  });

  ipcMain.handle(
    "library:search-history:add",
    (_event, payload: { keyword: string; source?: string | null }) => {
      return getAppDatabase().addSearchHistory(payload.keyword, payload.source);
    }
  );

  ipcMain.handle("library:search-history:list", (_event, limit?: number) => {
    return getAppDatabase().listSearchHistory(limit);
  });

  ipcMain.handle("library:search-history:clear", () => {
    return getAppDatabase().clearSearchHistory();
  });

  ipcMain.handle("library:search-history:delete", (_event, id: number) => {
    return getAppDatabase().deleteSearchHistory(id);
  });

  ipcMain.handle("library:play-history:add", (_event, track: TrackSnapshot) => {
    return getAppDatabase().addPlayHistory(track);
  });

  ipcMain.handle("library:play-history:list", (_event, limit?: number) => {
    return getAppDatabase().listPlayHistory(limit);
  });

  ipcMain.handle("library:queue-snapshot:get", () => {
    return getAppDatabase().getQueueSnapshot();
  });

  ipcMain.handle("library:queue-snapshot:save", (_event, snapshot: QueueSnapshotInput) => {
    return getAppDatabase().saveQueueSnapshot(snapshot);
  });

  ipcMain.handle("library:favorites:songs:list", () => {
    return getAppDatabase().listFavoriteSongs();
  });

  ipcMain.handle("library:favorites:songs:add", (_event, track: TrackSnapshot) => {
    const result = getAppDatabase().addFavoriteSong(track);
    notifyFavoritesChanged();
    return result;
  });

  ipcMain.handle("library:favorites:songs:remove", (_event, payload: { source: string; id: string }) => {
    const result = getAppDatabase().removeFavoriteSong(payload.source, payload.id);
    notifyFavoritesChanged();
    return result;
  });

  ipcMain.handle("library:favorites:songs:toggle", (_event, track: TrackSnapshot) => {
    const result = getAppDatabase().toggleFavoriteSong(track);
    notifyFavoritesChanged();
    return result;
  });

  ipcMain.handle("library:favorites:songs:contains", (_event, payload: { source: string; id: string }) => {
    return getAppDatabase().containsFavoriteSong(payload.source, payload.id);
  });

  ipcMain.handle("library:favorites:playlists:list", () => {
    return getAppDatabase().listFavoritePlaylists();
  });

  ipcMain.handle("library:favorites:playlists:add", (_event, playlist: PlaylistSnapshot) => {
    const result = getAppDatabase().addFavoritePlaylist(playlist);
    notifyFavoritesChanged();
    return result;
  });

  ipcMain.handle("library:favorites:playlists:remove", (_event, payload: { source: string; id: string }) => {
    const result = getAppDatabase().removeFavoritePlaylist(payload.source, payload.id);
    notifyFavoritesChanged();
    return result;
  });

  ipcMain.handle("library:favorites:playlists:toggle", (_event, playlist: PlaylistSnapshot) => {
    const result = getAppDatabase().toggleFavoritePlaylist(playlist);
    notifyFavoritesChanged();
    return result;
  });

  ipcMain.handle("library:favorites:playlists:contains", (_event, payload: { source: string; id: string }) => {
    return getAppDatabase().containsFavoritePlaylist(payload.source, payload.id);
  });

  ipcMain.handle("library:playlists:list", (_event, payload?: { source?: PlaylistSource | "all" }) => {
    return getAppDatabase().listUserPlaylists(payload?.source);
  });

  ipcMain.handle("library:playlists:create", (_event, playlist: Partial<PlaylistSnapshot>) => {
    return getAppDatabase().createUserPlaylist(playlist);
  });

  ipcMain.handle("library:playlists:upsert", (_event, playlist: PlaylistSnapshot) => {
    return getAppDatabase().upsertUserPlaylist(playlist);
  });

  ipcMain.handle(
    "library:playlists:replace-source",
    (_event, payload: { source: Exclude<PlaylistSource, "local">; playlists: PlaylistSnapshot[] }) => {
      return getAppDatabase().replaceUserPlaylists(payload.source, payload.playlists);
    }
  );

  ipcMain.handle("library:playlists:tracks:list", (_event, payload: { playlistId: string }) => {
    return getAppDatabase().listUserPlaylistTracks(payload.playlistId);
  });

  ipcMain.handle("library:playlists:tracks:add", (_event, payload: { playlistId: string; track: TrackSnapshot }) => {
    return getAppDatabase().addUserPlaylistTrack(payload.playlistId, payload.track);
  });

  ipcMain.handle("library:cloud:songs:list", (_event, payload?: { cloudSource?: string | "all" }) => {
    return getAppDatabase().listUserCloudSongs(payload?.cloudSource);
  });

  ipcMain.handle("library:cloud:songs:replace", (_event, payload: { cloudSource: string; songs: TrackSnapshot[] }) => {
    return getAppDatabase().replaceUserCloudSongs(payload.cloudSource, payload.songs);
  });
}

function notifyFavoritesChanged() {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("favorites:changed");
  });
}
