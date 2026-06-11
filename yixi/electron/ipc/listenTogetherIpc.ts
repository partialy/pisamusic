// 一起听 IPC：renderer 只能通过这里访问一起听 HTTP 接口与 socket 命令。
// 不暴露 socket 实例、token 与服务端地址；emit 命令经联合类型白名单校验。

import { ipcMain, type BrowserWindow } from "electron";
import type {
  ListenTogetherCreateRoomPayload,
  ListenTogetherSocketCommand,
} from "../../src/types/listenTogether";
import {
  createListenTogetherRoom,
  getListenTogetherConfig,
  getListenTogetherRoom,
} from "../listenTogether/listenTogetherHttpClient";
import {
  closeListenTogetherSocket,
  initListenTogetherService,
  openListenTogetherSocket,
  sendListenTogetherCommand,
} from "../listenTogether/listenTogetherService";

const COMMAND_TYPES: ReadonlySet<string> = new Set([
  "join",
  "leave",
  "sync",
  "play",
  "pause",
  "changeSong",
  "seek",
  "ended",
  "updateRoom",
  "queue",
  "kickMember",
  "transferHost",
]);

function isValidCommand(value: unknown): value is ListenTogetherSocketCommand {
  if (typeof value !== "object" || value === null) return false;
  const command = value as Record<string, unknown>;
  if (typeof command.type !== "string" || !COMMAND_TYPES.has(command.type)) return false;
  return typeof command.roomId === "string" && command.roomId.length > 0;
}

let registered = false;

export function setupListenTogetherIpc(getWindow: () => BrowserWindow | null): void {
  if (registered) return;
  registered = true;
  initListenTogetherService(getWindow);

  ipcMain.handle("listen-together:get-config", () => getListenTogetherConfig());

  ipcMain.handle("listen-together:create-room", (_event, payload: ListenTogetherCreateRoomPayload) =>
    createListenTogetherRoom(payload),
  );

  ipcMain.handle("listen-together:get-room", (_event, roomId: string) => getListenTogetherRoom(roomId));

  ipcMain.handle("listen-together:connect-socket", () => openListenTogetherSocket());

  ipcMain.handle("listen-together:disconnect-socket", () => {
    closeListenTogetherSocket();
    return true;
  });

  ipcMain.handle("listen-together:emit", (_event, command: unknown) => {
    if (!isValidCommand(command)) {
      return {
        ack: { success: false, code: -1, msg: "不支持的一起听命令", errorMsg: "INTERNAL_ERROR", data: null },
        rttMs: null,
      };
    }
    return sendListenTogetherCommand(command);
  });
}
