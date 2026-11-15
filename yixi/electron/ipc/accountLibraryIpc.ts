import { BrowserWindow, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { captureAccountLibrary } from "../account/accountLibraryContext";
import { getAppDatabase } from "../database";
import { scheduleLibrarySync } from "../sync/syncService";
import { createLocalTrackResolver, prepareLibraryTracks } from "../localLibrary/localTrackAccess";
import type { TrackSnapshot } from "../database/types";
import { importUnassociatedPlaylistCovers, wakeCoverUploads } from "../playlistCover/coverUploadManager";
const confirmations = new Map<string, { revision: number; expiresAt: number }>();
export function setupAccountLibraryIpc() {
  ipcMain.handle("library:identity", () => {
    const context = captureAccountLibrary();
    return { userId: context.scope.accountId, identityRevision: context.revision };
  });
  ipcMain.handle("library:local:resolve-tracks", (_event, tracks: TrackSnapshot[]) => {
    const { repo } = captureAccountLibrary();
    return prepareLibraryTracks(tracks, repo);
  });
  ipcMain.handle("library:unassociated:preview", previewUnassociated);
  ipcMain.handle("library:unassociated:prompt", () => {
    const context = captureAccountLibrary();
    if (!context.scope.accountId) return null;
    const promptedKey = `account-library-import-prompt:${context.scope.accountId}`;
    if (getAppDatabase().getSetting(promptedKey)?.value) return null;
    const preview = previewUnassociated();
    getAppDatabase().setSetting(promptedKey, true, 1);
    return preview.songs + preview.favorites + preview.playlists > 0 ? preview : null;
  });
  ipcMain.handle("library:unassociated:import", (_event, confirmationId: string) => {
    const context = captureAccountLibrary();
    const confirmation = confirmations.get(confirmationId);
    if (!confirmation || confirmation.revision !== context.revision || confirmation.expiresAt < Date.now() || !context.scope.accountId) throw new Error("导入确认已过期，请重新确认账号与数量");
    const result = getAppDatabase().applySyncTransaction(() => {
      const imported = context.repo.importUnassociated(createLocalTrackResolver(context.repo));
      importUnassociatedPlaylistCovers(context, imported.playlists);
      return imported;
    });
    confirmations.delete(confirmationId);
    scheduleLibrarySync();
    wakeCoverUploads();
    BrowserWindow.getAllWindows().forEach(win => { win.webContents.send("favorites:changed"); win.webContents.send("mine-library:changed"); });
    return result;
  });
}

function previewUnassociated() {
    const context = captureAccountLibrary();
    if (!context.scope.accountId) throw new Error("请先登录当前账号");
    const unassociated = getAppDatabase().accountLibrary({ ...context.scope, accountId: "" });
    confirmations.clear();
    const confirmationId = randomUUID();
    confirmations.set(confirmationId, { revision: context.revision, expiresAt: Date.now() + 300000 });
    return { confirmationId, identityRevision: context.revision, accountName: context.session.user.username || context.scope.accountId,
      songs: unassociated.listFavoriteSongs().length, favorites: unassociated.listFavoritePlaylists().length, playlists: unassociated.listUserPlaylists("local").length };
}
