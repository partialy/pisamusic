import { app } from "electron";
import { existsSync, mkdirSync } from "fs";
import path from "path";

let initialized = false;

export function setupEnvironmentUserDataPaths() {
  if (initialized) return;
  initialized = true;

  if (!app.isPackaged) {
    const appData = app.getPath("appData");
    const devUserData = path.join(appData, "PisaMusic-Dev");
    app.setPath("userData", devUserData);
    app.setName("PisaMusic-Dev");
  }
}

// 模块加载时自动执行一次环境隔离初始化，确保任何提前调用 getAppDataPath 的模块都能命中隔离后的路径
setupEnvironmentUserDataPaths();

export function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

export function getAppDataPath(...paths: string[]) {
  setupEnvironmentUserDataPaths();
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
