import { ipcMain } from "electron";
import { getAppDatabase } from "../database";
import type { QueueSnapshot, TrackSnapshot } from "../database/appDatabase";

let registered = false;

type QueueSnapshotInput = Pick<QueueSnapshot, "currentIndex" | "queue">;

export function setupPersistenceIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("settings:get", (_event, key: string) => {
    return getAppDatabase().getSetting(key);
  });

  ipcMain.handle(
    "settings:set",
    (_event, payload: { key: string; value: unknown; version?: number }) => {
      return getAppDatabase().setSetting(payload.key, payload.value, payload.version);
    }
  );

  ipcMain.handle("settings:delete", (_event, key: string) => {
    return getAppDatabase().deleteSetting(key);
  });

  ipcMain.handle(
    "library:search-history:add",
    (_event, payload: { keyword: string; source?: string | null }) => {
      return getAppDatabase().addSearchHistory(payload.keyword, payload.source);
    }
  );

  ipcMain.handle("library:search-history:list", (_event, limit?: number) => {
    return getAppDatabase().listSearchHistory(limit);
  });

  ipcMain.handle("library:search-history:clear", () => {
    return getAppDatabase().clearSearchHistory();
  });

  ipcMain.handle("library:search-history:delete", (_event, id: number) => {
    return getAppDatabase().deleteSearchHistory(id);
  });

  ipcMain.handle("library:play-history:add", (_event, track: TrackSnapshot) => {
    return getAppDatabase().addPlayHistory(track);
  });

  ipcMain.handle("library:play-history:list", (_event, limit?: number) => {
    return getAppDatabase().listPlayHistory(limit);
  });

  ipcMain.handle("library:queue-snapshot:get", () => {
    return getAppDatabase().getQueueSnapshot();
  });

  ipcMain.handle("library:queue-snapshot:save", (_event, snapshot: QueueSnapshotInput) => {
    return getAppDatabase().saveQueueSnapshot(snapshot);
  });
}
