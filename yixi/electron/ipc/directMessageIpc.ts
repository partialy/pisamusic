import { ipcMain } from "electron";
import { getDirectMessageManager } from "../directMessage/directMessageService";

let registered = false;

export function setupDirectMessageIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("direct-message:list-unread", (_event, options?: { forceRefresh?: boolean }) =>
    getDirectMessageManager().listUnread(options),
  );
  ipcMain.on("direct-message:dismiss", (_event, id: string) => {
    getDirectMessageManager().dismiss(typeof id === "string" ? id : "");
  });
}
