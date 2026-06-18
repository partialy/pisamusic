import { ipcMain } from "electron";
import { createShare, getPublicShare, type ShareType } from "../system/systemClient";

let registered = false;

export function setupShareIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("share:create", (_event, payload: { type: ShareType; rawJson: unknown }) => {
    return createShare(payload.type, payload.rawJson);
  });

  ipcMain.handle("share:public", (_event, uuid: string) => {
    return getPublicShare(uuid);
  });
}
