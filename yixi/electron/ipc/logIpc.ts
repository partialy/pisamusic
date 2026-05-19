import { dialog, ipcMain, shell } from "electron";
import fs from "fs";
import { copyFile } from "fs/promises";
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

type LogReadResult = {
  error: string | null;
  filePath: string | null;
  fileName: string | null;
  updatedAt: string | null;
  lines: string[];
};

type LogExportResult = {
  exported: boolean;
  filePath: string | null;
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

  ipcMain.handle("logs:recent", (_event, limit?: number) => {
    return readRecentLog(limit);
  });

  ipcMain.handle("logs:export", async () => {
    return exportRecentLog();
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

function readLogsByDate(dateInput?: string | Date): LogReadResult {
  try {
    const date = dateInput ? new Date(dateInput) : new Date();
    const dateStr = date.toISOString().split("T")[0];
    const filePath = path.join(getLogPath(), `application-${dateStr}.log`);

    if (!fs.existsSync(filePath)) {
      return {
        error: `No logs found for ${dateStr}`,
        filePath: null,
        fileName: null,
        updatedAt: null,
        lines: [],
      };
    }

    return readLogFile(filePath);
  } catch (error: any) {
    logger.error("read logs failed", {
      message: error?.message,
      stack: error?.stack,
    });
    return {
      error: error?.message || String(error),
      filePath: null,
      fileName: null,
      updatedAt: null,
      lines: [],
    };
  }
}

function readRecentLog(limit = 500): LogReadResult {
  const filePath = getRecentLogFilePath();
  if (!filePath) {
    return {
      error: "No log files found",
      filePath: null,
      fileName: null,
      updatedAt: null,
      lines: [],
    };
  }
  const result = readLogFile(filePath);
  const normalizedLimit = normalizeLimit(limit);
  return {
    ...result,
    lines: result.lines.slice(-normalizedLimit),
  };
}

async function exportRecentLog(): Promise<LogExportResult> {
  const sourcePath = getRecentLogFilePath();
  if (!sourcePath) return { exported: false, filePath: null };

  const result = await dialog.showSaveDialog({
    title: "导出日志文件",
    defaultPath: path.basename(sourcePath),
    filters: [{ name: "Log", extensions: ["log"] }],
  });
  if (result.canceled || !result.filePath) {
    return { exported: false, filePath: null };
  }

  await copyFile(sourcePath, result.filePath);
  return { exported: true, filePath: result.filePath };
}

function readLogFile(filePath: string): LogReadResult {
  const stat = fs.statSync(filePath);
  const lines = fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    error: null,
    filePath,
    fileName: path.basename(filePath),
    updatedAt: stat.mtime.toISOString(),
    lines,
  };
}

function getRecentLogFilePath() {
  const logDir = getLogPath();
  if (!fs.existsSync(logDir)) return null;
  const files = fs
    .readdirSync(logDir)
    .filter((name) => /^application-\d{4}-\d{2}-\d{2}\.log$/.test(name))
    .map((name) => {
      const filePath = path.join(logDir, name);
      return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.filePath ?? null;
}

function normalizeLimit(limit: number) {
  if (!Number.isFinite(limit)) return 500;
  return Math.min(Math.max(Math.floor(limit), 1), 2000);
}
