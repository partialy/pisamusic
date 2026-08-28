import { ipcMain } from "electron";
import {
  getCloudMusicSummary,
  getCloudMusicTrackDetail,
  searchCloudMusic,
} from "../cloudMusic/cloudMusicClient";

let registered = false;

export function setupCloudMusicIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("cloud-music:summary", async () => {
    return getCloudMusicSummary();
  });

  ipcMain.handle(
    "cloud-music:search",
    async (_event, input?: { keyword?: string; offset?: number; limit?: number }) => {
      const keyword = typeof input?.keyword === "string" ? input.keyword.trim() : undefined;
      const offset = Math.max(0, parseInt(String(input?.offset ?? "0"), 10) || 0);
      const limit = typeof input?.limit === "number" ? Math.min(100, Math.max(1, input.limit)) : 20;

      return searchCloudMusic({
        keyword,
        offset,
        limit,
      });
    }
  );

  ipcMain.handle("cloud-music:detail", async (_event, uuid: string) => {
    return getCloudMusicTrackDetail(uuid);
  });
}
