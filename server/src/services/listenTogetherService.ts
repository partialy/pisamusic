import { readDynamicConfigById } from "../db/dynamicConfigStore";
import {
  addUserSocket,
  clearOfflineTimer,
  createRoom as createRoomInStore,
  deleteRoom,
  getRoom,
  getUserRoom,
  getUserSockets,
  removeUserRoom,
  removeUserSocket,
  setOfflineTimer,
  setUserRoom,
  updateRoom,
} from "../db/listenTogetherStore";
import type { PublicUser } from "../db/userStore";
import {
  LISTEN_TOGETHER_CONFIG_ID,
  LISTEN_TOGETHER_DEFAULT_MAX_PEOPLE,
  LISTEN_TOGETHER_MAX_PEOPLE,
  LISTEN_TOGETHER_MIN_PEOPLE,
  LISTEN_TOGETHER_OFFLINE_GRACE_MS,
  ListenTogetherError,
  type ListenTogetherBroadcast,
  type ListenTogetherConfig,
  type ListenTogetherCreateRoomInput,
  type ListenTogetherMember,
  type ListenTogetherPublicRoom,
  type ListenTogetherRoom,
  type ListenTogetherSocketUser,
  userFromPublicUser,
} from "../realtime/listenTogether/listenTogetherTypes";
import {
  generateRoomId,
  normalizeMaxPeople,
  normalizeMemberOperation,
  normalizeOptionalRoomId,
  normalizePosition,
  normalizeSong,
  roomIdRule,
  validateRoomId,
  validateRoomName,
} from "../realtime/listenTogether/listenTogetherValidator";

type RoomChangeResult = {
  room: ListenTogetherPublicRoom;
  broadcast: ListenTogetherBroadcast;
};

type LeaveRoomResult = {
  roomName: string;
  removedUserId: string;
  targetSocketIds: string[];
  broadcasts: ListenTogetherBroadcast[];
  destroyed: boolean;
};

type JoinRoomResult = {
  room: ListenTogetherPublicRoom;
  member: ListenTogetherMember;
  shouldBroadcast: boolean;
  broadcast?: ListenTogetherBroadcast;
  serverTime: number;
};

type ExpireUserResult = LeaveRoomResult | null;

function now(): number {
  return Date.now();
}

function clampMaxPeople(value: unknown): number {
  const num = Math.floor(Number(value));
  if (!Number.isFinite(num)) return LISTEN_TOGETHER_MAX_PEOPLE;
  return Math.min(LISTEN_TOGETHER_MAX_PEOPLE, Math.max(LISTEN_TOGETHER_MIN_PEOPLE, num));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function publicRoom(room: ListenTogetherRoom): ListenTogetherPublicRoom {
  return {
    ...room,
    song: room.song ? { ...room.song } : null,
    currentPeople: room.members.length,
    members: room.members.map((member) => ({ ...member })),
  };
}

function requireRoom(roomId: unknown): ListenTogetherRoom {
  const id = validateRoomId(roomId);
  const room = getRoom(id);
  if (!room) {
    throw new ListenTogetherError("房间不存在", "ROOM_NOT_FOUND", 404);
  }
  return room;
}

function findMember(room: ListenTogetherRoom, userId: string): ListenTogetherMember | null {
  return room.members.find((member) => member.userId === userId) ?? null;
}

function requireMember(room: ListenTogetherRoom, userId: string): ListenTogetherMember {
  const member = findMember(room, userId);
  if (!member) {
    throw new ListenTogetherError("用户不在房间内", "NOT_IN_ROOM", 400);
  }
  return member;
}

function ensureUserInRoom(room: ListenTogetherRoom, userId: string): ListenTogetherMember {
  const userRoom = getUserRoom(userId);
  if (userRoom !== room.roomId) {
    throw new ListenTogetherError("用户不在房间内", "NOT_IN_ROOM", 400);
  }
  return requireMember(room, userId);
}

function ensureHost(room: ListenTogetherRoom, userId: string): void {
  ensureUserInRoom(room, userId);
  if (room.hostUserId !== userId) {
    throw new ListenTogetherError("只有房主可以操作", "NO_PERMISSION", 400);
  }
}

function ensureCanControl(room: ListenTogetherRoom, userId: string): void {
  ensureUserInRoom(room, userId);
  if (room.hostUserId === userId || room.memberOperation) return;
  throw new ListenTogetherError("没有操作权限", "NO_PERMISSION", 400);
}

function incrementRoom(room: ListenTogetherRoom): void {
  room.version += 1;
  room.updatedAt = now();
}

function operator(user: ListenTogetherSocketUser) {
  return {
    userId: user.userId,
    nickname: user.nickname,
  };
}

function broadcast<T>(room: ListenTogetherRoom, event: ListenTogetherBroadcast["event"], data: T): ListenTogetherBroadcast<T> {
  return {
    event,
    roomId: room.roomId,
    serverTime: now(),
    version: room.version,
    data,
  };
}

function memberFromUser(user: ListenTogetherSocketUser, role: ListenTogetherMember["role"], timestamp: number): ListenTogetherMember {
  return {
    ...user,
    role,
    online: true,
    joinedAt: timestamp,
    lastSeenAt: timestamp,
  };
}

function updateMemberIdentity(member: ListenTogetherMember, user: ListenTogetherSocketUser, timestamp: number): void {
  member.username = user.username;
  member.nickname = user.nickname;
  member.avatarUrl = user.avatarUrl;
  member.online = true;
  member.lastSeenAt = timestamp;
}

function firstHostCandidate(room: ListenTogetherRoom): ListenTogetherMember | null {
  return [...room.members].sort((a, b) => a.joinedAt - b.joinedAt)[0] ?? null;
}

function transferHostIfNeeded(room: ListenTogetherRoom, removedUserId: string): { oldHostUserId: string; newHostUserId: string } | null {
  if (room.hostUserId !== removedUserId) return null;
  const nextHost = firstHostCandidate(room);
  if (!nextHost) return null;
  const oldHostUserId = room.hostUserId;
  room.hostUserId = nextHost.userId;
  for (const member of room.members) {
    member.role = member.userId === nextHost.userId ? "host" : "member";
  }
  return { oldHostUserId, newHostUserId: nextHost.userId };
}

function removeMemberFromRoom(room: ListenTogetherRoom, userId: string): LeaveRoomResult {
  const member = requireMember(room, userId);
  const roomName = room.roomId;
  room.members = room.members.filter((item) => item.userId !== userId);
  removeUserRoom(userId);
  clearOfflineTimer(userId);
  incrementRoom(room);

  const transfer = transferHostIfNeeded(room, userId);
  const targetSocketIds = getUserSockets(userId);
  if (room.members.length === 0) {
    const destroyedRoom = publicRoom(room);
    const destroyed = broadcast(room, "ROOM_DESTROYED", { room: destroyedRoom, removedUserId: userId });
    deleteRoom(room.roomId);
    return {
      roomName,
      removedUserId: userId,
      targetSocketIds,
      broadcasts: [destroyed],
      destroyed: true,
    };
  }

  updateRoom(room);
  const current = publicRoom(room);
  const broadcasts: ListenTogetherBroadcast[] = [
    broadcast(room, "MEMBER_LEFT", {
      userId,
      member,
      newHostUserId: transfer?.newHostUserId ?? room.hostUserId,
      members: current.members,
    }),
  ];
  if (transfer) {
    broadcasts.push(
      broadcast(room, "HOST_TRANSFERRED", {
        oldHostUserId: transfer.oldHostUserId,
        newHostUserId: transfer.newHostUserId,
        members: current.members,
      }),
    );
  }
  return {
    roomName,
    removedUserId: userId,
    targetSocketIds,
    broadcasts,
    destroyed: false,
  };
}

export function readListenTogetherConfig(): ListenTogetherConfig {
  const item = readDynamicConfigById(LISTEN_TOGETHER_CONFIG_ID);
  return {
    maxPeopleLimit: clampMaxPeople(item?.content),
    defaultMaxPeople: LISTEN_TOGETHER_DEFAULT_MAX_PEOPLE,
    ...roomIdRule(),
  };
}

export function createListenTogetherRoom(user: PublicUser, input: ListenTogetherCreateRoomInput): ListenTogetherPublicRoom {
  const authUser = userFromPublicUser(user);
  const existingRoomId = getUserRoom(authUser.userId);
  const replaceExisting = input.replaceExisting === true;
  if (existingRoomId && !replaceExisting) {
    throw new ListenTogetherError("用户已经在其它房间内", "USER_ALREADY_HAS_ROOM", 400);
  }
  if (existingRoomId) {
    leaveListenTogetherRoom(authUser.userId, existingRoomId);
  }
  const config = readListenTogetherConfig();
  const requestedRoomId = normalizeOptionalRoomId(input.roomId);
  let roomId = requestedRoomId;
  if (roomId && getRoom(roomId)) {
    throw new ListenTogetherError("房间号已存在", "ROOM_ID_EXISTS", 409);
  }
  if (!roomId) {
    for (let i = 0; i < 10; i += 1) {
      const candidate = generateRoomId();
      if (!getRoom(candidate)) {
        roomId = candidate;
        break;
      }
    }
  }
  if (!roomId) {
    throw new ListenTogetherError("房间号生成失败", "INTERNAL_ERROR", 500);
  }
  const timestamp = now();
  const room: ListenTogetherRoom = {
    roomId,
    roomName: validateRoomName(input.roomName),
    hostUserId: authUser.userId,
    song: null,
    status: "paused",
    position: 0,
    maxPeople: normalizeMaxPeople(input.maxPeople, config.maxPeopleLimit),
    memberOperation: normalizeMemberOperation(input.memberOperation),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 0,
    members: [memberFromUser(authUser, "host", timestamp)],
  };
  return publicRoom(createRoomInStore(room));
}

export function getListenTogetherRoom(roomId: unknown): ListenTogetherPublicRoom {
  return publicRoom(requireRoom(roomId));
}

export function joinListenTogetherRoom(user: ListenTogetherSocketUser, roomIdInput: unknown): JoinRoomResult {
  const room = requireRoom(roomIdInput);
  const existingRoomId = getUserRoom(user.userId);
  if (existingRoomId && existingRoomId !== room.roomId) {
    throw new ListenTogetherError("用户已经在其它房间内", "USER_ALREADY_HAS_ROOM", 400);
  }
  const timestamp = now();
  const existingMember = findMember(room, user.userId);
  if (existingMember) {
    const wasOffline = !existingMember.online;
    updateMemberIdentity(existingMember, user, timestamp);
    setUserRoom(user.userId, room.roomId);
    clearOfflineTimer(user.userId);
    if (wasOffline) {
      incrementRoom(room);
      updateRoom(room);
      const current = publicRoom(room);
      return {
        room: current,
        member: { ...existingMember },
        shouldBroadcast: true,
        broadcast: broadcast(room, "MEMBER_JOINED", { member: { ...existingMember }, members: current.members }),
        serverTime: now(),
      };
    }
    updateRoom(room);
    return {
      room: publicRoom(room),
      member: { ...existingMember },
      shouldBroadcast: false,
      serverTime: now(),
    };
  }
  if (room.members.length >= room.maxPeople) {
    throw new ListenTogetherError("房间人数已满", "ROOM_FULL", 400);
  }
  const member = memberFromUser(user, "member", timestamp);
  room.members.push(member);
  setUserRoom(user.userId, room.roomId);
  incrementRoom(room);
  updateRoom(room);
  const current = publicRoom(room);
  return {
    room: current,
    member: { ...member },
    shouldBroadcast: true,
    broadcast: broadcast(room, "MEMBER_JOINED", { member: { ...member }, members: current.members }),
    serverTime: now(),
  };
}

export function leaveListenTogetherRoom(userId: string, roomIdInput: unknown): LeaveRoomResult {
  const room = requireRoom(roomIdInput);
  ensureUserInRoom(room, userId);
  return removeMemberFromRoom(room, userId);
}

export function playListenTogether(user: ListenTogetherSocketUser, payload: unknown): RoomChangeResult {
  const body = isRecord(payload) ? payload : {};
  const room = requireRoom(body.roomId);
  ensureCanControl(room, user.userId);
  const data = isRecord(body.data) ? body.data : {};
  const song = normalizeSong(data.song);
  const position = normalizePosition(data.position, song.duration);
  room.song = song;
  room.status = "playing";
  room.position = position;
  incrementRoom(room);
  updateRoom(room);
  return {
    room: publicRoom(room),
    broadcast: broadcast(room, "ROOM_STATE_CHANGED", {
      action: "PLAY",
      room: publicRoom(room),
      operator: operator(user),
    }),
  };
}

export function pauseListenTogether(user: ListenTogetherSocketUser, payload: unknown): RoomChangeResult {
  const body = isRecord(payload) ? payload : {};
  const room = requireRoom(body.roomId);
  ensureCanControl(room, user.userId);
  const data = isRecord(body.data) ? body.data : {};
  room.status = "paused";
  room.position = normalizePosition(data.position, room.song?.duration);
  incrementRoom(room);
  updateRoom(room);
  return {
    room: publicRoom(room),
    broadcast: broadcast(room, "ROOM_STATE_CHANGED", {
      action: "PAUSE",
      room: publicRoom(room),
      operator: operator(user),
    }),
  };
}

export function changeListenTogetherSong(user: ListenTogetherSocketUser, payload: unknown): RoomChangeResult {
  const body = isRecord(payload) ? payload : {};
  const room = requireRoom(body.roomId);
  ensureCanControl(room, user.userId);
  const data = isRecord(body.data) ? body.data : {};
  room.song = normalizeSong(data.song);
  room.position = 0;
  room.status = data.autoPlay === false ? "paused" : "playing";
  incrementRoom(room);
  updateRoom(room);
  return {
    room: publicRoom(room),
    broadcast: broadcast(room, "ROOM_STATE_CHANGED", {
      action: "CHANGE_SONG",
      room: publicRoom(room),
      operator: operator(user),
    }),
  };
}

export function seekListenTogether(user: ListenTogetherSocketUser, payload: unknown): RoomChangeResult {
  const body = isRecord(payload) ? payload : {};
  const room = requireRoom(body.roomId);
  ensureCanControl(room, user.userId);
  const data = isRecord(body.data) ? body.data : {};
  room.position = normalizePosition(data.position, room.song?.duration);
  incrementRoom(room);
  updateRoom(room);
  return {
    room: publicRoom(room),
    broadcast: broadcast(room, "ROOM_STATE_CHANGED", {
      action: "SEEK",
      room: publicRoom(room),
      operator: operator(user),
    }),
  };
}

export function endListenTogether(user: ListenTogetherSocketUser, payload: unknown): RoomChangeResult {
  const body = isRecord(payload) ? payload : {};
  const room = requireRoom(body.roomId);
  ensureCanControl(room, user.userId);
  const data = isRecord(body.data) ? body.data : {};
  room.status = "ended";
  room.position = normalizePosition(data.position, room.song?.duration);
  incrementRoom(room);
  updateRoom(room);
  return {
    room: publicRoom(room),
    broadcast: broadcast(room, "ROOM_STATE_CHANGED", {
      action: "ENDED",
      room: publicRoom(room),
      operator: operator(user),
    }),
  };
}

export function syncListenTogetherRoom(
  user: ListenTogetherSocketUser,
  roomIdInput: unknown,
): { room: ListenTogetherPublicRoom; serverTime: number; broadcast?: ListenTogetherBroadcast } {
  const room = requireRoom(roomIdInput);
  const member = ensureUserInRoom(room, user.userId);
  let changed: ListenTogetherBroadcast | undefined;
  if (!member.online) {
    updateMemberIdentity(member, user, now());
    clearOfflineTimer(user.userId);
    incrementRoom(room);
    updateRoom(room);
    const current = publicRoom(room);
    changed = broadcast(room, "MEMBER_JOINED", { member: { ...member }, members: current.members });
  }
  return { room: publicRoom(room), serverTime: now(), broadcast: changed };
}

export function updateListenTogetherRoom(user: ListenTogetherSocketUser, payload: unknown): RoomChangeResult {
  const body = isRecord(payload) ? payload : {};
  const room = requireRoom(body.roomId);
  ensureHost(room, user.userId);
  const data = isRecord(body.data) ? body.data : {};
  if (Object.prototype.hasOwnProperty.call(data, "roomName")) {
    room.roomName = validateRoomName(data.roomName);
  }
  if (Object.prototype.hasOwnProperty.call(data, "maxPeople")) {
    const config = readListenTogetherConfig();
    const maxPeople = normalizeMaxPeople(data.maxPeople, config.maxPeopleLimit);
    if (maxPeople < room.members.length) {
      throw new ListenTogetherError("最大人数不能小于当前房间人数", "INVALID_MAX_PEOPLE", 400);
    }
    room.maxPeople = maxPeople;
  }
  if (Object.prototype.hasOwnProperty.call(data, "memberOperation")) {
    room.memberOperation = Boolean(data.memberOperation);
  }
  incrementRoom(room);
  updateRoom(room);
  return {
    room: publicRoom(room),
    broadcast: broadcast(room, "ROOM_UPDATED", {
      room: publicRoom(room),
      operator: operator(user),
    }),
  };
}

export function kickListenTogetherMember(user: ListenTogetherSocketUser, payload: unknown): LeaveRoomResult {
  const body = isRecord(payload) ? payload : {};
  const room = requireRoom(body.roomId);
  ensureHost(room, user.userId);
  const data = isRecord(body.data) ? body.data : {};
  const targetUserId = typeof data.targetUserId === "string" ? data.targetUserId.trim() : "";
  if (!targetUserId) {
    throw new ListenTogetherError("目标用户不在房间内", "TARGET_USER_NOT_FOUND", 400);
  }
  if (targetUserId === user.userId) {
    throw new ListenTogetherError("不能踢出自己", "NO_PERMISSION", 400);
  }
  const target = findMember(room, targetUserId);
  if (!target) {
    throw new ListenTogetherError("目标用户不在房间内", "TARGET_USER_NOT_FOUND", 400);
  }
  if (target.role === "host") {
    throw new ListenTogetherError("不能踢出房主", "HOST_CANNOT_BE_KICKED", 400);
  }
  const targetSocketIds = getUserSockets(targetUserId);
  room.members = room.members.filter((member) => member.userId !== targetUserId);
  removeUserRoom(targetUserId);
  clearOfflineTimer(targetUserId);
  incrementRoom(room);
  updateRoom(room);
  const current = publicRoom(room);
  return {
    roomName: room.roomId,
    removedUserId: targetUserId,
    targetSocketIds,
    broadcasts: [
      broadcast(room, "MEMBER_KICKED", {
        targetUserId,
        operator: operator(user),
        members: current.members,
      }),
    ],
    destroyed: false,
  };
}

export function transferListenTogetherHost(user: ListenTogetherSocketUser, payload: unknown): RoomChangeResult {
  const body = isRecord(payload) ? payload : {};
  const room = requireRoom(body.roomId);
  ensureHost(room, user.userId);
  const data = isRecord(body.data) ? body.data : {};
  const targetUserId = typeof data.targetUserId === "string" ? data.targetUserId.trim() : "";
  const target = targetUserId ? findMember(room, targetUserId) : null;
  if (!target || target.userId === user.userId) {
    throw new ListenTogetherError("目标用户不在房间内", "TARGET_USER_NOT_FOUND", 400);
  }
  const oldHostUserId = room.hostUserId;
  room.hostUserId = target.userId;
  for (const member of room.members) {
    member.role = member.userId === target.userId ? "host" : "member";
  }
  incrementRoom(room);
  updateRoom(room);
  return {
    room: publicRoom(room),
    broadcast: broadcast(room, "HOST_TRANSFERRED", {
      oldHostUserId,
      newHostUserId: target.userId,
      members: publicRoom(room).members,
    }),
  };
}

export function connectListenTogetherSocket(userId: string, socketId: string): void {
  addUserSocket(userId, socketId);
}

export function disconnectListenTogetherSocket(
  userId: string,
  socketId: string,
  onExpired: (result: ExpireUserResult) => void,
): void {
  const remaining = removeUserSocket(userId, socketId);
  if (remaining > 0) return;
  const roomId = getUserRoom(userId);
  if (!roomId) return;
  const room = getRoom(roomId);
  if (!room) return;
  const member = findMember(room, userId);
  if (!member) return;
  member.online = false;
  member.lastSeenAt = now();
  incrementRoom(room);
  updateRoom(room);
  setOfflineTimer(
    userId,
    setTimeout(() => {
      clearOfflineTimer(userId);
      onExpired(expireOfflineListenTogetherMember(userId));
    }, LISTEN_TOGETHER_OFFLINE_GRACE_MS),
  );
}

export function expireOfflineListenTogetherMember(userId: string): ExpireUserResult {
  const roomId = getUserRoom(userId);
  if (!roomId) return null;
  const room = getRoom(roomId);
  if (!room) return null;
  const member = findMember(room, userId);
  if (!member || member.online) return null;
  return removeMemberFromRoom(room, userId);
}
