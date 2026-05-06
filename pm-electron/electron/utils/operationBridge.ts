import { ipcMain } from "electron";
import { existsSync, readFileSync } from "fs";
import { logger } from "./logger";
import fs from "fs";
import path from "path";
import { systemConfig, data_path, electronConfig } from "../../config/config";
import { collectStore } from "../store";

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

  // 迁移期兼容旧 renderer：真实服务端与音源 baseURL 后续由 ServerConfigService 提供。
  ipcMain.handle("get-request-url", async () => {
    return {
      urlConfig: {},
      mainServer: electronConfig.main_server,
    };
  });

  ipcMain.handle("get-electron-config", async () => {
    return electronConfig;
  });

  ipcMain.handle("get-server-port", async () => {
    const fallback = electronConfig.main_server || "";
    return {
      backServer: {
        kgServer: fallback,
        wyServer: fallback,
        kwServer: fallback,
        kgProxy: fallback,
        wyProxy: fallback,
        kwProxy: fallback,
      },
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
      const filePath = path.join(systemConfig.logPath, filename);

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

  // 收藏功能
  ipcMain.handle(
    "readFile",
    async (
      _,
      params: {
        folder: string;
        filename: string;
        dataType: "object" | "list";
      }
    ) => {
      try {
        const dir = path.join(data_path, params.folder);
        if (!existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        if (!existsSync(path.join(data_path, params.folder, params.filename))) {
          fs.writeFileSync(
            path.join(data_path, params.folder, params.filename),
            params.dataType === "object" ? "{}" : "[]"
          );
        }
        const res = readFileSync(
          path.join(data_path, params.folder, params.filename),
          "utf-8"
        );
        return {
          success: true,
          data: res,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );

  // 写入文件
  ipcMain.handle(
    "writeFile",
    async (
      _,
      params: {
        folder: string;
        filename: string;
        data: string;
      }
    ) => {
      try {
        const dir = path.join(data_path, params.folder);
        if (!existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(
          path.join(data_path, params.folder, params.filename),
          params.data
        );
        return {
          success: true,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );
}

export function setupStoreIpc() {
  // store
  ipcMain.on("collect-song", (_, song) => {
    collectStore.set(`songs.${song.id}`, song);
  });

  ipcMain.on("incollect-song", (_, song) => {
    collectStore.set(`songs.${song.id}`, song);
    collectStore.delete(`songs.${song.id}`); // 直接删除
  });

  ipcMain.handle("collected-songs", () => {
    const songsObject = collectStore.get("songs");
    // 使用 Object.values 获取对象的所有值
    return Object.values(songsObject || {});
  });

  ipcMain.on("remove-song", (_, song) => {
    collectStore.delete(`songs.${song.id}`);
  });

  // --- playlists 相关 ---
  ipcMain.on("collect-list", (_, list) => {
    collectStore.set(`playlists.${list.id}`, list);
  });

  ipcMain.on("incollect-list", (_, list) => {
    collectStore.delete(`playlists.${list.id}`);
  });

  ipcMain.handle("collected-lists", () => {
    const playlistsObject = collectStore.get("playlists");
    // 使用 Object.values 获取对象的所有值
    return Object.values(playlistsObject || {});
  });

  ipcMain.on("remove-list", (_, list) => {
    collectStore.delete(`playlists.${list.id}`);
  });
}
