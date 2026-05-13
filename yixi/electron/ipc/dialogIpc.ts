import { dialog, ipcMain } from "electron";

let registered = false;

export function setupDialogIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("dialog:select-directory", async (_event, title?: string) => {
    const result = await dialog.showOpenDialog({
      title,
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0] ?? null;
  });
}
