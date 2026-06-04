import type { ListenTogetherRoom } from "../realtime/listenTogether/listenTogetherTypes";

const rooms = new Map<string, ListenTogetherRoom>();
const userRooms = new Map<string, string>();
const userSockets = new Map<string, Set<string>>();
const offlineTimers = new Map<string, NodeJS.Timeout>();

export function createRoom(room: ListenTogetherRoom): ListenTogetherRoom {
  rooms.set(room.roomId, room);
  userRooms.set(room.hostUserId, room.roomId);
  return room;
}

export function getRoom(roomId: string): ListenTogetherRoom | null {
  return rooms.get(roomId) ?? null;
}

export function updateRoom(room: ListenTogetherRoom): ListenTogetherRoom {
  rooms.set(room.roomId, room);
  return room;
}

export function deleteRoom(roomId: string): boolean {
  const room = rooms.get(roomId);
  if (room) {
    for (const member of room.members) {
      userRooms.delete(member.userId);
      clearOfflineTimer(member.userId);
    }
  }
  return rooms.delete(roomId);
}

export function listRooms(): ListenTogetherRoom[] {
  return [...rooms.values()];
}

export function getUserRoom(userId: string): string | null {
  return userRooms.get(userId) ?? null;
}

export function setUserRoom(userId: string, roomId: string): void {
  userRooms.set(userId, roomId);
}

export function removeUserRoom(userId: string): void {
  userRooms.delete(userId);
}

export function addUserSocket(userId: string, socketId: string): void {
  const sockets = userSockets.get(userId) ?? new Set<string>();
  sockets.add(socketId);
  userSockets.set(userId, sockets);
}

export function removeUserSocket(userId: string, socketId: string): number {
  const sockets = userSockets.get(userId);
  if (!sockets) return 0;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(userId);
    return 0;
  }
  return sockets.size;
}

export function getUserSockets(userId: string): string[] {
  return [...(userSockets.get(userId) ?? new Set<string>())];
}

export function setOfflineTimer(userId: string, timer: NodeJS.Timeout): void {
  clearOfflineTimer(userId);
  offlineTimers.set(userId, timer);
}

export function clearOfflineTimer(userId: string): void {
  const timer = offlineTimers.get(userId);
  if (timer) clearTimeout(timer);
  offlineTimers.delete(userId);
}

export function hasOfflineTimer(userId: string): boolean {
  return offlineTimers.has(userId);
}
