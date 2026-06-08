import type { Server } from "socket.io";
import { getRoom, getUserSockets } from "../../db/listenTogetherStore";
import {
  changeListenTogetherSong,
  connectListenTogetherSocket,
  disconnectListenTogetherSocket,
  endListenTogether,
  joinListenTogetherRoom,
  kickListenTogetherMember,
  leaveListenTogetherRoom,
  pauseListenTogether,
  playListenTogether,
  seekListenTogether,
  syncListenTogetherRoom,
  transferListenTogetherHost,
  updateListenTogetherRoom,
} from "../../services/listenTogetherService";
import type { AuthedRealtimeSocket } from "../socketTypes";
import { listenTogetherClientEvents } from "./listenTogetherEvents";
import {
  ListenTogetherError,
  listenRoomName,
  type ListenTogetherAck,
  type ListenTogetherBroadcast,
} from "./listenTogetherTypes";

type AckFn = (response: ListenTogetherAck) => void;

type LeaveResult = ReturnType<typeof leaveListenTogetherRoom>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ackOk<T>(ack: AckFn | undefined, data: T, msg = "ok"): void {
  ack?.({ success: true, code: 0, msg, data });
}

function ackError(ack: AckFn | undefined, error: unknown): void {
  if (error instanceof ListenTogetherError) {
    ack?.({
      success: false,
      code: error.statusCode,
      msg: error.message,
      errorMsg: error.errorMsg,
      data: null,
    });
    return;
  }
  ack?.({
    success: false,
    code: 500,
    msg: error instanceof Error ? error.message : "服务端错误",
    errorMsg: "INTERNAL_ERROR",
    data: null,
  });
}

function roomIdFromPayload(payload: unknown): unknown {
  return isRecord(payload) ? payload.roomId : undefined;
}

function stringFromPayload(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function emitBroadcast(io: Server, message: ListenTogetherBroadcast): void {
  io.to(listenRoomName(message.roomId)).emit(message.event, message);
}

function emitBroadcastFromSocket(socket: AuthedRealtimeSocket, message: ListenTogetherBroadcast): void {
  socket.to(listenRoomName(message.roomId)).emit(message.event, message);
}

function leaveTargetSockets(io: Server, result: LeaveResult): void {
  const roomName = listenRoomName(result.roomName);
  for (const socketId of result.targetSocketIds) {
    io.sockets.sockets.get(socketId)?.leave(roomName);
  }
}

function broadcastLeaveResult(io: Server, result: LeaveResult): void {
  const shouldNotifyRemoved = result.broadcasts.some((message) => message.event === "MEMBER_KICKED");
  if (shouldNotifyRemoved) {
    for (const message of result.broadcasts) emitBroadcast(io, message);
    leaveTargetSockets(io, result);
    return;
  }
  leaveTargetSockets(io, result);
  for (const message of result.broadcasts) emitBroadcast(io, message);
}

function registerRoomChangeEvent(
  io: Server,
  socket: AuthedRealtimeSocket,
  eventName: string,
  handler: (user: AuthedRealtimeSocket["data"]["user"], payload: unknown) => { broadcast: ListenTogetherBroadcast; room: unknown },
): void {
  socket.on(eventName, (payload: unknown, ack?: AckFn) => {
    try {
      const result = handler(socket.data.user, payload);
      ackOk(ack, { room: result.room });
      // 排除发送者，避免 host 自己 emit change_song / play / pause 后还收到自己的回声，
      // 触发 syncPlayerToRoom 在客户端做二次播放器同步，引发快速连点时两首歌反复跳动。
      // 发送者已经通过 ack(result.room) 拿到最新房间状态。
      emitBroadcastFromSocket(socket, result.broadcast);
    } catch (error) {
      ackError(ack, error);
    }
  });
}

function registerQueueEvent(io: Server, socket: AuthedRealtimeSocket): void {
  socket.on(listenTogetherClientEvents.queue, (payload: unknown, ack?: AckFn) => {
    try {
      const body = isRecord(payload) ? payload : {};
      const roomId = stringFromPayload(body.roomId);
      const room = getRoom(roomId);
      if (!room) throw new ListenTogetherError("房间不存在", "ROOM_NOT_FOUND", 400);
      const member = room.members.find((item) => item.userId === socket.data.user.userId);
      if (!member) throw new ListenTogetherError("用户不在房间内", "NOT_IN_ROOM", 400);

      const data = isRecord(body.data) ? body.data : {};
      const targetUserId = stringFromPayload(data.targetUserId);
      if (targetUserId && !room.members.some((item) => item.userId === targetUserId)) {
        throw new ListenTogetherError("目标用户不在房间内", "TARGET_USER_NOT_FOUND", 400);
      }

      const message: ListenTogetherBroadcast = {
        event: "QUEUE_EVENT",
        roomId,
        serverTime: Date.now(),
        version: 0,
        data: {
          ...data,
          fromUserId: socket.data.user.userId,
        },
      };
      ackOk(ack, { serverTime: message.serverTime });
      if (targetUserId) {
        for (const socketId of getUserSockets(targetUserId)) {
          io.sockets.sockets.get(socketId)?.emit(message.event, message);
        }
      } else {
        emitBroadcastFromSocket(socket, message);
      }
    } catch (error) {
      ackError(ack, error);
    }
  });
}

export function registerListenTogetherSocket(io: Server, socket: AuthedRealtimeSocket): void {
  const user = socket.data.user;
  connectListenTogetherSocket(user.userId, socket.id);

  socket.on(listenTogetherClientEvents.join, (payload: unknown, ack?: AckFn) => {
    try {
      const result = joinListenTogetherRoom(user, roomIdFromPayload(payload));
      const roomName = listenRoomName(result.room.roomId);
      socket.join(roomName);
      ackOk(ack, { room: result.room, serverTime: result.serverTime }, "加入成功");
      if (result.shouldBroadcast && result.broadcast) {
        emitBroadcastFromSocket(socket, result.broadcast);
      }
    } catch (error) {
      ackError(ack, error);
    }
  });

  socket.on(listenTogetherClientEvents.leave, (payload: unknown, ack?: AckFn) => {
    try {
      const result = leaveListenTogetherRoom(user.userId, roomIdFromPayload(payload));
      ackOk(ack, null, "离开成功");
      broadcastLeaveResult(io, result);
    } catch (error) {
      ackError(ack, error);
    }
  });

  registerRoomChangeEvent(io, socket, listenTogetherClientEvents.play, playListenTogether);
  registerRoomChangeEvent(io, socket, listenTogetherClientEvents.pause, pauseListenTogether);
  registerRoomChangeEvent(io, socket, listenTogetherClientEvents.changeSong, changeListenTogetherSong);
  registerRoomChangeEvent(io, socket, listenTogetherClientEvents.seek, seekListenTogether);
  registerRoomChangeEvent(io, socket, listenTogetherClientEvents.ended, endListenTogether);
  registerRoomChangeEvent(io, socket, listenTogetherClientEvents.updateRoom, updateListenTogetherRoom);
  registerRoomChangeEvent(io, socket, listenTogetherClientEvents.transferHost, transferListenTogetherHost);
  registerQueueEvent(io, socket);

  socket.on(listenTogetherClientEvents.sync, (payload: unknown, ack?: AckFn) => {
    try {
      const result = syncListenTogetherRoom(user, roomIdFromPayload(payload));
      socket.join(listenRoomName(result.room.roomId));
      ackOk(ack, { room: result.room, serverTime: result.serverTime });
      if (result.broadcast) emitBroadcastFromSocket(socket, result.broadcast);
    } catch (error) {
      ackError(ack, error);
    }
  });

  socket.on(listenTogetherClientEvents.kickMember, (payload: unknown, ack?: AckFn) => {
    try {
      const result = kickListenTogetherMember(user, payload);
      ackOk(ack, null, "已移出成员");
      broadcastLeaveResult(io, result);
    } catch (error) {
      ackError(ack, error);
    }
  });

  socket.on("disconnect", () => {
    disconnectListenTogetherSocket(user.userId, socket.id, (result) => {
      if (result) broadcastLeaveResult(io, result);
    });
  });
}
