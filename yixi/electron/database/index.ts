import { getDatabasePath } from "../core/appPaths";
import { AppDatabase } from "./appDatabase";

let appDatabase: AppDatabase | null = null;

export function getAppDatabase() {
  if (!appDatabase) {
    appDatabase = new AppDatabase(getDatabasePath());
  }
  return appDatabase;
}

export function closeAppDatabase() {
  appDatabase?.close();
  appDatabase = null;
}
