// 一起听 main 侧服务：管理 socket 生命周期，把连接状态与服务端广播推送给主窗口。
// 不操作播放器、不维护房间业务状态——加入/同步/队列协议都由 renderer 状态机驱动。

import type { BrowserWindow } from "electron";
import type {
  ListenTogetherBroadcast,
  ListenTogetherCommandResult,
  ListenTogetherConnectionEvent,
  ListenTogetherSocketCommand,
} from "../../src/types/listenTogether";
import { logger } from "../utils/logger";
import { getAccountSession } from "../system/systemClient";
import {
  connectListenTogetherSocket,
  disconnectListenTogetherSocket,
  emitListenTogetherCommand,
  isListenTogetherSocketConnected,
} from "./listenTogetherSocketClient";

const CONNECTION_CHANNEL = "listen-together:connection";
const BROADCAST_CHANNEL = "listen-together:broadcast";

let getMainWindow: () => BrowserWindow | null = () => null;

export function initListenTogetherService(getWindow: () => BrowserWindow | null): void {
  getMainWindow = getWindow;
}

function pushToRenderer(channel: string, payload: unknown): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) return;
  window.webContents.send(channel, payload);
}

function pushConnectionEvent(event: ListenTogetherConnectionEvent): void {
  pushToRenderer(CONNECTION_CHANNEL, event);
}

/** 打开 socket：main 内读取账号 token，renderer 不经手；连接成功不等于加入房间 */
export function openListenTogetherSocket(): { ok: boolean; msg?: string } {
  const session = getAccountSession();
  if (!session.loggedIn) {
    return { ok: false, msg: "请先登录账号" };
  }
  connectListenTogetherSocket(session.token, {
    onConnected: () => pushConnectionEvent({ type: "connected" }),
    onDisconnected: (reason) => pushConnectionEvent({ type: "disconnected", reason }),
    onConnectError: (message) => {
      logger.warn("listen-together socket connect error", { message });
      pushConnectionEvent({ type: "connect-error", message });
    },
    onBroadcast: (_event, message: ListenTogetherBroadcast) => {
      pushToRenderer(BROADCAST_CHANNEL, message);
    },
  });
  return { ok: true };
}

export function closeListenTogetherSocket(): void {
  disconnectListenTogetherSocket();
}

export function isListenTogetherConnected(): boolean {
  return isListenTogetherSocketConnected();
}

export async function sendListenTogetherCommand(
  command: ListenTogetherSocketCommand,
): Promise<ListenTogetherCommandResult> {
  return emitListenTogetherCommand(command);
}
