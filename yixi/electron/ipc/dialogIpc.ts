import { dialog, ipcMain } from "electron";
import { copyFile, mkdir } from "fs/promises";
import path from "path";
import { getAppDataPath } from "../core/appPaths";

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

  ipcMain.handle("dialog:select-playlist-cover", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择歌单封面",
      properties: ["openFile"],
      filters: [
        {
          name: "Images",
          extensions: ["jpg", "jpeg", "png", "webp", "gif"],
        },
      ],
    });
    if (result.canceled || !result.filePaths.length) return null;

    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath).toLowerCase() || ".png";
    const coverDir = getAppDataPath("covers", "playlists");
    await mkdir(coverDir, { recursive: true });
    const targetPath = path.join(coverDir, `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    await copyFile(sourcePath, targetPath);
    return `file:///${targetPath.replace(/\\/g, "/")}`;
  });
}
