import { ipcMain } from "electron";
import { getColorFromUrl } from "../utils/color";

let registered = false;

export function setupUtilsIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("utils:get-color-from-url", (_event, url: string) => {
    return getColorFromUrl(url);
  });
}
