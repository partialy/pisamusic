import { ipcMain, shell } from "electron";
import fs from "fs";
import path from "path";
import { getLogPath } from "../core/appPaths";
import { logger } from "../utils/logger";

type RendererErrorPayload = {
  message?: string;
  stack?: string;
  name?: string;
  context?: Record<string, unknown>;
  time?: string;
};

let registered = false;

export function setupLogIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("app:log", (_event, data: unknown) => {
    logger.info("renderer log", { data });
    return true;
  });

  ipcMain.handle("app:log-error", (_event, payload: RendererErrorPayload) => {
    logRendererError(payload);
    return true;
  });

  ipcMain.handle("logs:list", (_event, dateInput?: string | Date) => {
    return readLogsByDate(dateInput);
  });

  ipcMain.handle("logs:open-dir", async () => {
    await shell.openPath(getLogPath());
    return true;
  });
}

export function logRendererError(payload: RendererErrorPayload) {
  logger.error("renderer error", {
    message: payload?.message,
    stack: payload?.stack,
    name: payload?.name,
    context: payload?.context,
    time: payload?.time,
  });
}

function readLogsByDate(dateInput?: string | Date) {
  try {
    const date = dateInput ? new Date(dateInput) : new Date();
    const dateStr = date.toISOString().split("T")[0];
    const filePath = path.join(getLogPath(), `application-${dateStr}.log`);

    if (!fs.existsSync(filePath)) {
      return { error: `No logs found for ${dateStr}`, data: [] };
    }

    const data = fs
      .readFileSync(filePath, "utf-8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return { error: null, data };
  } catch (error: any) {
    logger.error("read logs failed", {
      message: error?.message,
      stack: error?.stack,
    });
    return { error: error?.message || String(error), data: [] };
  }
}

