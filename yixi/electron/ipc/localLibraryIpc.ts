import { ipcMain } from "electron";
import {
  getLocalLibraryScanStatus,
  listLocalSongs,
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
}
