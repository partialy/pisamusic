// 一起听 Socket.IO 客户端（main 进程，单例连接）。
// 鉴权 token 只在 main 内读取；renderer 通过 typed IPC 发送受限命令并取得 ACK + 真实 RTT。

import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import type {
  ListenTogetherAck,
  ListenTogetherBroadcast,
  ListenTogetherBroadcastEvent,
  ListenTogetherCommandResult,
  ListenTogetherSocketCommand,
} from "../../src/types/listenTogether";
import { getSystemBaseUrl } from "../system/systemClient";

export type ListenTogetherSocketListener = {
  onConnected: () => void;
  onDisconnected: (reason: string) => void;
  onConnectError: (message: string) => void;
  onBroadcast: (event: ListenTogetherBroadcastEvent, message: ListenTogetherBroadcast) => void;
};

const BROADCAST_EVENTS: ListenTogetherBroadcastEvent[] = [
  "ROOM_STATE_CHANGED",
  "ROOM_UPDATED",
  "MEMBER_JOINED",
  "MEMBER_LEFT",
  "MEMBER_KICKED",
  "HOST_TRANSFERRED",
  "ROOM_DESTROYED",
  "QUEUE_EVENT",
  "ERROR_MESSAGE",
];

/** ACK 等待上限：超时转成明确错误，不允许永久 pending */
const ACK_TIMEOUT_MS = 10_000;

let socket: Socket | null = null;

export function connectListenTogetherSocket(token: string, listener: ListenTogetherSocketListener): void {
  // 单例连接：重复 connect 前先清理旧监听和旧 socket
  disconnectListenTogetherSocket();
  const client = io(getSystemBaseUrl(), {
    transports: ["websocket"],
    auth: { token: `Bearer ${token}` },
  });
  client.on("connect", () => listener.onConnected());
  client.on("disconnect", (reason) => listener.onDisconnected(String(reason ?? "")));
  client.on("connect_error", (error) => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    listener.onConnectError(message || "一起听连接失败");
  });
  for (const event of BROADCAST_EVENTS) {
    client.on(event, (message: ListenTogetherBroadcast) => listener.onBroadcast(event, message));
  }
  socket = client;
}

export function disconnectListenTogetherSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function isListenTogetherSocketConnected(): boolean {
  return socket?.connected === true;
}

type EmitPayload = {
  event: string;
  body: {
    requestId: string;
    roomId: string;
    action: string;
    data: Record<string, unknown>;
  };
};

function failureAck(
  code: number,
  msg: string,
  errorMsg: "SOCKET_DISCONNECTED" | "ACK_TIMEOUT" | "INTERNAL_ERROR",
): ListenTogetherAck {
  return { success: false, code, msg, errorMsg, data: null };
}

/** 把受限命令联合映射为 socket 事件与 PM 同构 payload（{ requestId, roomId, action, data }） */
function buildEmitPayload(command: ListenTogetherSocketCommand): EmitPayload | null {
  const requestId = randomUUID();
  const base = (event: string, action: string, data: Record<string, unknown>): EmitPayload => ({
    event,
    body: { requestId, roomId: command.roomId, action, data },
  });
  switch (command.type) {
    case "join":
      return base("listen:join", "JOIN", {});
    case "leave":
      return base("listen:leave", "LEAVE", {});
    case "sync":
      return base("listen:sync", "SYNC", {});
    case "play":
      return base("listen:play", "PLAY", {
        song: command.song,
        songRef: { source: command.song.source, id: command.song.id },
        position: command.position,
        ...(command.transitionId ? { transitionId: command.transitionId } : {}),
      });
    case "pause":
      return base("listen:pause", "PAUSE", {
        songRef: command.songRef,
        position: command.position,
        ...(command.transitionId ? { transitionId: command.transitionId } : {}),
      });
    case "changeSong":
      return base("listen:change_song", "CHANGE_SONG", {
        song: command.song,
        autoPlay: command.autoPlay,
        ...(command.transitionId ? { transitionId: command.transitionId } : {}),
        ...(command.queueItemId ? { queueItemId: command.queueItemId } : {}),
      });
    case "seek":
      return base("listen:seek", "SEEK", {
        songRef: command.songRef,
        position: command.position,
        ...(command.transitionId ? { transitionId: command.transitionId } : {}),
      });
    case "ended":
      return base("listen:ended", "ENDED", {
        songRef: command.songRef,
        position: command.position,
        ...(command.transitionId ? { transitionId: command.transitionId } : {}),
      });
    case "updateRoom": {
      // 服务端按字段存在性局部更新，未传字段不能出现在 data 中
      const data: Record<string, unknown> = {};
      if (command.roomName !== undefined) data.roomName = command.roomName;
      if (command.maxPeople !== undefined) data.maxPeople = command.maxPeople;
      if (command.memberOperation !== undefined) data.memberOperation = command.memberOperation;
      return base("listen:update_room", "UPDATE_ROOM", data);
    }
    case "queue":
      return base("listen:queue", "QUEUE", {
        ...(command.data ?? {}),
        kind: command.kind,
        ...(command.targetUserId ? { targetUserId: command.targetUserId } : {}),
      });
    case "kickMember":
      return base("listen:kick_member", "KICK_MEMBER", { targetUserId: command.targetUserId });
    case "transferHost":
      return base("listen:transfer_host", "TRANSFER_HOST", { targetUserId: command.targetUserId });
    default:
      return null;
  }
}

function normalizeAck(raw: unknown): ListenTogetherAck {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return failureAck(-1, "服务端响应无效", "INTERNAL_ERROR");
  }
  const value = raw as Record<string, unknown>;
  return {
    success: value.success === true,
    code: typeof value.code === "number" ? value.code : -1,
    msg: typeof value.msg === "string" ? value.msg : "",
    data: value.data,
    ...(typeof value.errorMsg === "string" ? { errorMsg: value.errorMsg } : {}),
  } as ListenTogetherAck;
}

export async function emitListenTogetherCommand(
  command: ListenTogetherSocketCommand,
): Promise<ListenTogetherCommandResult> {
  const client = socket;
  if (!client || !client.connected) {
    return { ack: failureAck(-1, "一起听连接已断开", "SOCKET_DISCONNECTED"), rttMs: null };
  }
  const payload = buildEmitPayload(command);
  if (!payload) {
    return { ack: failureAck(-1, "不支持的一起听命令", "INTERNAL_ERROR"), rttMs: null };
  }
  const sentAt = performance.now();
  try {
    const raw = await client.timeout(ACK_TIMEOUT_MS).emitWithAck(payload.event, payload.body);
    const rttMs = Math.max(0, Math.round(performance.now() - sentAt));
    return { ack: normalizeAck(raw), rttMs };
  } catch {
    return { ack: failureAck(-1, "一起听操作超时", "ACK_TIMEOUT"), rttMs: null };
  }
}
