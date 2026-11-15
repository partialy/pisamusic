import { ipcMain } from "electron";
import { captureAccountLibrary } from "../account/accountLibraryContext";
import { selectManagedPlaylistCover } from "../playlistCover/coverAssets";
import { retryPlaylistCover, savePlaylistEdit, startCoverUploads } from "../playlistCover/coverUploadManager";
import type { PlaylistEditInput } from "../../src/types/playlistCover";
export function setupPlaylistCoverIpc() {
  ipcMain.handle("playlist-cover:select", selectManagedPlaylistCover);
  ipcMain.handle("playlist-cover:save-edit", (_event, input: PlaylistEditInput) => savePlaylistEdit(captureAccountLibrary(), input));
  ipcMain.handle("playlist-cover:retry", (_event, input: { playlistId: string; identityRevision: number }) => {
    const context = captureAccountLibrary();
    if (input.identityRevision !== context.revision) throw new Error("账号已变化，请重试");
    retryPlaylistCover(context, input.playlistId);
  });
  startCoverUploads();
}
