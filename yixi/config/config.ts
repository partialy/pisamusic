import path from "path";
import fs from "fs";

const config = JSON.parse(
  fs.readFileSync(path.resolve("data/electronConfig.json"), "utf-8")
);
export const systemConfig = {
  logPath: process.env.logPath || path.resolve("data/logs"),
};
ensureDirExists(systemConfig.logPath);
function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export const serverConfig = {
  port: process.env.port || 30000,
  host: process.env.host || "0.0.0.0",
};

export const data_path = path.resolve(config.DATA_PATH);

export const electronConfig = {
  data_path: config.DATA_PATH,
  main_server: config.MAIN_SERVER,
  ...config,
} as {
  data_path: string;
  main_server: string;
  [key: string]: any;
};
