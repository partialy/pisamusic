import type { Server } from "socket.io";
import {
  listenRoomName,
  type ListenTogetherBroadcast,
} from "./listenTogetherTypes";

let publisherIo: Server | null = null;

export function initListenTogetherPublisher(io: Server): void {
  publisherIo = io;
}

export function getListenTogetherPublisher(): Server | null {
  return publisherIo;
}

export function publishBroadcast(message: ListenTogetherBroadcast): void {
  if (!publisherIo) return;
  publisherIo.to(listenRoomName(message.roomId)).emit(message.event, message);
}

export function publishLeaveRoomResult(result: {
  roomName: string;
  removedUserId: string;
  targetSocketIds: string[];
  broadcasts: ListenTogetherBroadcast[];
  destroyed: boolean;
}): void {
  if (!publisherIo) return;
  const roomName = listenRoomName(result.roomName);
  const shouldNotifyRemoved = result.broadcasts.some(
    (message) => message.event === "MEMBER_KICKED" || message.event === "ROOM_DESTROYED",
  );

  if (shouldNotifyRemoved) {
    for (const message of result.broadcasts) {
      publisherIo.to(roomName).emit(message.event, message);
    }
    for (const socketId of result.targetSocketIds) {
      publisherIo.sockets.sockets.get(socketId)?.leave(roomName);
    }
    return;
  }

  for (const socketId of result.targetSocketIds) {
    publisherIo.sockets.sockets.get(socketId)?.leave(roomName);
  }
  for (const message of result.broadcasts) {
    publisherIo.to(roomName).emit(message.event, message);
  }
}
