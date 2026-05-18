import { ipcMain } from "electron";
import {
  getLocalLibraryScanStatus,
  getLocalSongCover,
  listLocalSongs,
  removeLocalSongFromList,
  refreshLocalLibrary,
} from "../localLibrary/localLibraryService";

let registered = false;

export function setupLocalLibraryIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("library:local:songs:list", () => {
    return listLocalSongs();
  });

  ipcMain.handle("library:local:scan-status", () => {
    return getLocalLibraryScanStatus();
  });

  ipcMain.handle("library:local:refresh", () => {
    return refreshLocalLibrary();
  });

  ipcMain.handle("library:local:cover", (_event, filePath: string) => {
    return getLocalSongCover(filePath);
  });

  ipcMain.handle("library:local:songs:remove", (_event, payload: { filePath?: string; deleteFile?: boolean }) => {
    return removeLocalSongFromList(payload);
  });
}
