import path from "node:path";
import fs from "node:fs";

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const dataPath = path.resolve(process.env.PISA_DESKTOP_DATA_PATH || "data");
const logPath = process.env.PISA_DESKTOP_LOG_PATH || path.join(dataPath, "logs");

export const systemConfig = {
  logPath,
};

ensureDirExists(systemConfig.logPath);

export const serverConfig = {
  port: Number(process.env.PISA_DESKTOP_DEV_PORT || 30000),
  host: process.env.PISA_DESKTOP_DEV_HOST || "0.0.0.0",
};

export const data_path = dataPath;

export const electronConfig = {
  data_path: dataPath,
  main_server: process.env.PISA_SERVER_BASE_URL || "",
  DATA_PATH: dataPath,
  MAIN_SERVER: process.env.PISA_SERVER_BASE_URL || "",
  produce_port: process.env.PISA_DESKTOP_PRODUCE_PORT || "52220",
};
