import { BrowserWindow, ipcMain } from "electron";
import { getAppDatabase } from "../database";
import type { QueueSnapshot, TrackSnapshot } from "../database/appDatabase";
import { captureAccountLibrary, isCurrentLibrary } from "../account/accountLibraryContext";
import { scheduleLibrarySync } from "../sync/syncService";
import { createLocalTrackResolver, prepareLibraryTrack, prepareLibraryTracks } from "../localLibrary/localTrackAccess";
import { setupAccountLibraryIpc } from "./accountLibraryIpc";
import { assertPublicSetting } from "./publicSettingsPolicy";

import { setupPlaylistCoverIpc } from "./playlistCoverIpc";
import { decoratePlaylist, discardPlaylistCover } from "../playlistCover/coverUploadManager";

let registered = false;

type QueueSnapshotInput = Pick<QueueSnapshot, "currentIndex" | "queue">;

export function setupPersistenceIpc() {
  if (registered) return;
  registered = true;
  setupAccountLibraryIpc();
  setupPlaylistCoverIpc();

  ipcMain.handle("settings:get", (_event, key: string) => {
    assertPublicSetting(key);
    return getAppDatabase().getSetting(key);
  });

  ipcMain.handle(
    "settings:set",
    (_event, payload: { key: string; value: unknown; version?: number }) => {
      assertPublicSetting(payload.key);
      return getAppDatabase().setSetting(payload.key, payload.value, payload.version);
    }
  );

  ipcMain.handle("settings:delete", (_event, key: string) => {
    assertPublicSetting(key);
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

  const scoped = (channel: string, write: boolean, work: (context: ReturnType<typeof captureAccountLibrary>, payload: any) => unknown) => {
    ipcMain.handle(channel, (_event, payload, expectedRevision?: number) => {
      const context = captureAccountLibrary();
      if (expectedRevision !== undefined && expectedRevision !== context.revision) throw new Error("账号已变化，请重试");
      if (payload?.identityRevision !== undefined && payload.identityRevision !== context.revision) throw new Error("账号已变化，请重试");
      const result = work(context, payload);
      if (write && isCurrentLibrary(context)) {
        notifyFavoritesChanged();
        notifyMineLibraryChanged();
        scheduleLibrarySync();
      }
      return result;
    });
  };
  const readTrack = (context: ReturnType<typeof captureAccountLibrary>, track: TrackSnapshot) => prepareLibraryTrack(track, context.repo);
  scoped("library:favorites:songs:list", false, context => {
    const resolve = createLocalTrackResolver(context.repo);
    return context.repo.listFavoriteSongs().map(item => ({ ...item, payload: resolve(item.payload) }));
  });
  scoped("library:favorites:songs:add", true, (context, track) => context.repo.addFavoriteSong(readTrack(context, track)));
  scoped("library:favorites:songs:ensure", true, (context, track) => ({ added: context.repo.ensureFavoriteSong(readTrack(context, track)) }));
  scoped("library:favorites:songs:remove", true, (context, payload) => context.repo.removeFavoriteSong(payload.source, payload.id));
  scoped("library:favorites:songs:toggle", true, (context, track) => context.repo.toggleFavoriteSong(readTrack(context, track)));
  scoped("library:favorites:songs:contains", false, (context, payload) => context.repo.containsFavoriteSong(payload.source, payload.id));
  scoped("library:favorites:playlists:list", false, context => context.repo.listFavoritePlaylists());
  scoped("library:favorites:playlists:add", true, (context, playlist) => context.repo.addFavoritePlaylist(playlist));
  scoped("library:favorites:playlists:remove", true, (context, payload) => context.repo.removeFavoritePlaylist(payload.source, payload.id));
  scoped("library:favorites:playlists:toggle", true, (context, playlist) => context.repo.toggleFavoritePlaylist(playlist));
  scoped("library:favorites:playlists:contains", false, (context, payload) => context.repo.containsFavoritePlaylist(payload.source, payload.id));
  scoped("library:playlists:list", false, (context, payload) => context.repo.listUserPlaylists(payload?.source).map(item => decoratePlaylist(context, item)));
  scoped("library:playlists:create", true, (context, playlist) => context.repo.createUserPlaylist(playlist).playlist);
  scoped("library:playlists:upsert", true, (context, playlist) => context.repo.upsertUserPlaylist(playlist));
  scoped("library:playlists:replace-source", true, (context, payload) => context.repo.replaceUserPlaylists(payload.source, payload.playlists));
  scoped("library:playlists:import", true, (context, payload) => context.repo.importUserPlaylists(Array.isArray(payload?.playlists) ? payload.playlists : []));
  scoped("library:playlists:tracks:list", false, (context, payload) => {
    const resolve = createLocalTrackResolver(context.repo);
    return context.repo.listUserPlaylistTracks(payload.playlistId).map(item => ({ ...item, payload: resolve(item.payload) }));
  });
  scoped("library:playlists:tracks:add", true, (context, payload) => context.repo.addUserPlaylistTrack(payload.playlistId, readTrack(context, payload.track)));
  scoped("library:playlists:create-with-tracks", true, (context, payload) => context.repo.createUserPlaylist(payload.playlist, prepareLibraryTracks(payload.tracks, context.repo)));
  scoped("library:playlists:update", true, (context, payload) => context.repo.updateUserPlaylist(payload.playlistId, payload.patch));
  scoped("library:playlists:remove", true, (context, payload) => getAppDatabase().applySyncTransaction(() => { const removed = context.repo.removeUserPlaylist(payload.source, payload.id); if (removed && payload.source === "local") discardPlaylistCover(context, payload.id); return removed; }));
  scoped("library:playlists:tracks:bulk-add", true, (context, payload) => context.repo.addUserPlaylistTracks(payload.playlistId, prepareLibraryTracks(payload.tracks, context.repo)));
  scoped("library:playlists:tracks:bulk-remove", true, (context, payload) => context.repo.removeUserPlaylistTracks(payload.playlistId, payload.keys));

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

function notifyMineLibraryChanged() {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("mine-library:changed");
  });
}
