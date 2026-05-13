import { app, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getAppDatabase } from "../database";

let registered = false;

export function setupDebugIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("debug:is-development-runtime", () => !app.isPackaged);

  ipcMain.handle(
    "debug:network-errors:list",
    (_event, payload?: { page?: number; pageSize?: number }) => {
      return getAppDatabase().listNetworkErrorRecords(payload?.page, payload?.pageSize);
    }
  );

  ipcMain.handle("debug:network-errors:detail", (_event, id: number) => {
    return getAppDatabase().getNetworkErrorRecord(id);
  });

  ipcMain.handle("debug:network-errors:export", async (_event, limit: number) => {
    const safeLimit = limit === 100 ? 100 : 10;
    const timestamp = formatExportTimestamp(new Date());
    const fileName = `pisa-network-errors-${safeLimit}-${timestamp}.json`;
    const result = await dialog.showSaveDialog({
      title: "导出网络错误记录",
      defaultPath: path.join(app.getPath("documents"), fileName),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) {
      return { exported: false, filePath: null, count: 0 };
    }

    const records = getAppDatabase().exportNetworkErrorRecords(safeLimit);
    await writeFile(
      result.filePath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          count: records.length,
          records,
        },
        null,
        2
      ),
      "utf-8"
    );
    return { exported: true, filePath: result.filePath, count: records.length };
  });
}

function formatExportTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}
