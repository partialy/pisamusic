import { ipcMain } from "electron";
import { logger } from "./logger";
import fs from "fs";
import path from "path";
import { getLegacyDataPath, getLogPath } from "../core/appPaths";
import { getRuntimeEndpointsCached, getSystemBaseUrl } from "../system/systemClient";

export async function ipcMainEventHandle(win: Electron.BrowserWindow) {
  // const urlConfig = (await electronAPI.getRequestUrl()).urlConfig;

  // 最小化窗口
  ipcMain.on("minimize-window", () => {
    win?.minimize();
  });

  // 最大化或还原窗口
  ipcMain.on("maximize-window", () => {
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  // 关闭窗口
  ipcMain.on("close-window", () => {
    win?.close();
  });

  // 最小化到任务栏
  ipcMain.on("hide-window", () => {
    win?.hide();
    win?.webContents.send("hide-window");
  });

  // 获取请求url
  ipcMain.handle("get-request-url", async () => {
    const endpoints = await getRuntimeEndpointsCached();
    return {
      urlConfig: endpoints,
      TARGET_URL: {
        kg: endpoints.kgServer,
        wy: endpoints.wyServer,
        kw: endpoints.kwServer,
      },
      PORT: "",
    };
  });

  ipcMain.handle("get-server-port", async () => {
    const backServer = await getRuntimeEndpointsCached();
    return {
      main_server: getSystemBaseUrl(),
      backServer,
    };
  });

  ipcMain.handle("get-electron-config", async () => {
    return {
      main_server: getSystemBaseUrl(),
      data_path: getLegacyDataPath(),
    };
  });

  ipcMain.handle("log", async (_, data: any) => {
    logger.info(`from web: ${data}`);
  });
}

export async function setupFileIpc(_win: Electron.BrowserWindow) {
  ipcMain.handle("get-logs", async (_, date: Date) => {
    try {
      // 1. 根据日期生成日志文件名
      const dateStr = date.toISOString().split("T")[0]; // 格式化为 YYYY-MM-DD
      const filename = `application-${dateStr}.log`;
      const filePath = path.join(getLogPath(), filename);

      // 2. 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return { error: `No logs found for ${dateStr}`, data: null };
      }

      // 3. 读取文件内容
      const logContent = fs.readFileSync(filePath, "utf-8");
      const lines = logContent.split("\n");
      const data = lines.map((line) => {
        const fixedString = line
          .replace(/\\n/g, "\n") // 替换 \\n 为 \n
          .replace(/\r$/, "") // 移除末尾的 \r
          .replace(/\n/g, "");
        return fixedString.trim();
      });
      return { error: null, data };
    } catch (err: any) {
      return { error: err.message, data: null };
    }
  });

}
