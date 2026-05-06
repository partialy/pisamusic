import { app } from "electron";
import { existsSync, mkdirSync } from "fs";
import path from "path";

export function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

export function getAppDataPath(...paths: string[]) {
  return ensureDir(path.join(app.getPath("userData"), "data", ...paths));
}

export function getDatabasePath(filename = "pisamusic.db") {
  return path.join(getAppDataPath("db"), filename);
}

export function getLogPath() {
  return getAppDataPath("logs");
}

export function getLegacyDataPath() {
  return getAppDataPath("legacy");
}
