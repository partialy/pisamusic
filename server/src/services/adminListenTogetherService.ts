import {
  clearOfflineTimer,
  deleteRoom,
  getRoom,
  getRoomByRecordId,
  getUserSockets,
  listRooms,
  removeUserRoom,
} from "../db/listenTogetherStore";
import {
  closeRoomRecord,
  listRoomHistory,
  readRoomHistoryDetail,
  type AdminRoomHistoryDetail,
  type AdminRoomHistoryListItem,
  type AdminRoomHistoryQuery,
} from "../db/listenTogetherHistoryStore";
import {
  ListenTogetherError,
  sanitizeSongSnapshot,
  type ListenTogetherBroadcast,
  type ListenTogetherPublicRoom,
  type ListenTogetherRoom,
  type ListenTogetherSongSnapshot,
  type ListenTogetherStatus,
  type ListenTogetherSocketUser,
} from "../realtime/listenTogether/listenTogetherTypes";
import { publishLeaveRoomResult } from "../realtime/listenTogether/listenTogetherPublisher";

export type AdminOnlineRoomListItem = {
  recordId: string;
  roomId: string;
  roomName: string;
  host: ListenTogetherSocketUser;
  song: ListenTogetherSongSnapshot | null;
  playbackStatus: ListenTogetherStatus;
  position: number;
  onlinePeople: number;
  currentPeople: number;
  maxPeople: number;
  memberOperation: boolean;
  peakPeople: number;
  totalJoinCount: number;
  uniquePeople: number;
  createdAt: number;
  updatedAt: number;
};

export type AdminOnlineRoomDetail = AdminOnlineRoomListItem & {
  version: number;
  members: Array<{
    userId: string;
    username: string;
    nickname: string;
    avatarUrl: string;
    role: "host" | "member";
    online: boolean;
    joinedAt: number;
    lastSeenAt: number;
  }>;
};

export type AdminOnlineRoomPage = {
  items: AdminOnlineRoomListItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminRoomHistoryPage = {
  items: AdminRoomHistoryListItem[];
  total: number;
  offset: number;
  limit: number;
};

function hostFromRoom(room: ListenTogetherRoom): ListenTogetherSocketUser {
  const hostMember = room.members.find((m) => m.userId === room.hostUserId);
  if (hostMember) {
    return {
      userId: hostMember.userId,
      username: hostMember.username,
      nickname: hostMember.nickname,
      avatarUrl: hostMember.avatarUrl,
    };
  }
  return {
    userId: room.hostUserId,
    username: "",
    nickname: "",
    avatarUrl: "",
  };
}

export function listAdminOnlineRooms(input: {
  keyword?: string;
  offset: number;
  limit: number;
}): AdminOnlineRoomPage {
  const allRooms = listRooms();
  const kw = input.keyword ? input.keyword.trim().toLowerCase() : "";

  let filtered = allRooms.map((room) => {
    const host = hostFromRoom(room);
    const onlinePeople = room.members.filter((m) => m.online).length;
    const currentPeople = room.members.length;
    const historyDetail = room.recordId ? readRoomHistoryDetail(room.recordId) : null;
    const peakPeople = historyDetail?.peakPeople ?? currentPeople;
    const totalJoinCount = historyDetail?.totalJoinCount ?? currentPeople;
    const uniquePeople = historyDetail?.uniquePeople ?? currentPeople;

    const item: AdminOnlineRoomListItem = {
      recordId: room.recordId || room.roomId,
      roomId: room.roomId,
      roomName: room.roomName,
      host,
      song: sanitizeSongSnapshot(room.song),
      playbackStatus: room.status,
      position: room.position,
      onlinePeople,
      currentPeople,
      maxPeople: room.maxPeople,
      memberOperation: room.memberOperation,
      peakPeople,
      totalJoinCount,
      uniquePeople,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
    return item;
  });

  if (kw) {
    filtered = filtered.filter((item) => {
      return (
        item.recordId.toLowerCase().includes(kw) ||
        item.roomId.toLowerCase().includes(kw) ||
        item.roomName.toLowerCase().includes(kw) ||
        item.host.userId.toLowerCase().includes(kw) ||
        item.host.username.toLowerCase().includes(kw) ||
        item.host.nickname.toLowerCase().includes(kw)
      );
    });
  }

  // Sort by updatedAt DESC, createdAt DESC
  filtered.sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);

  const total = filtered.length;
  const limit = Math.max(1, Math.min(100, input.limit || 20));
  const offset = Math.max(0, input.offset || 0);
  const items = filtered.slice(offset, offset + limit);

  return {
    items,
    total,
    offset,
    limit,
  };
}

export function readAdminOnlineRoom(recordId: string): AdminOnlineRoomDetail | null {
  const room = getRoomByRecordId(recordId);
  if (!room) return null;

  const host = hostFromRoom(room);
  const onlinePeople = room.members.filter((m) => m.online).length;
  const currentPeople = room.members.length;
  const historyDetail = room.recordId ? readRoomHistoryDetail(room.recordId) : null;
  const peakPeople = historyDetail?.peakPeople ?? currentPeople;
  const totalJoinCount = historyDetail?.totalJoinCount ?? currentPeople;
  const uniquePeople = historyDetail?.uniquePeople ?? currentPeople;

  return {
    recordId: room.recordId || room.roomId,
    roomId: room.roomId,
    roomName: room.roomName,
    host,
    song: sanitizeSongSnapshot(room.song),
    playbackStatus: room.status,
    position: room.position,
    onlinePeople,
    currentPeople,
    maxPeople: room.maxPeople,
    memberOperation: room.memberOperation,
    peakPeople,
    totalJoinCount,
    uniquePeople,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    version: room.version,
    members: room.members.map((m) => ({
      userId: m.userId,
      username: m.username,
      nickname: m.nickname,
      avatarUrl: m.avatarUrl,
      role: m.role,
      online: m.online,
      joinedAt: m.joinedAt,
      lastSeenAt: m.lastSeenAt,
    })),
  };
}

export function listAdminRoomHistory(input: AdminRoomHistoryQuery): AdminRoomHistoryPage {
  return listRoomHistory(input);
}

export function readAdminRoomHistory(recordId: string): AdminRoomHistoryDetail | null {
  return readRoomHistoryDetail(recordId);
}

export function dissolveAdminOnlineRoom(input: {
  recordId: string;
  adminUsername: string;
}): { recordId: string; roomId: string; endedAt: number } {
  const room = getRoomByRecordId(input.recordId);
  if (!room) {
    throw new ListenTogetherError("房间不存在或已结束", "ROOM_NOT_FOUND", 404);
  }

  const roomId = room.roomId;
  const recordId = room.recordId || roomId;
  const endedAt = Date.now();
  const host = hostFromRoom(room);

  // Synchronous critical section
  const allSocketIds = room.members.flatMap((m) => getUserSockets(m.userId));

  // 1. Close history record
  closeRoomRecord({
    roomRecordId: recordId,
    endedAt,
    endReason: "admin_dissolved",
    endedByAdmin: input.adminUsername,
    finalHost: host,
    lastSong: room.song,
    finalPlaybackStatus: room.status,
    finalPosition: room.position,
  });

  // 2. Clear timers and userRooms
  for (const member of room.members) {
    clearOfflineTimer(member.userId);
    removeUserRoom(member.userId);
  }

  // 3. Remove runtime room
  deleteRoom(roomId);

  // 4. Construct broadcast
  const destroyedBroadcast: ListenTogetherBroadcast = {
    event: "ROOM_DESTROYED",
    roomId,
    serverTime: endedAt,
    version: room.version + 1,
    data: {
      room: {
        ...room,
        currentPeople: 0,
      } as unknown as ListenTogetherPublicRoom,
      reason: "admin_dissolved",
    },
  };

  // 5. Publish to sockets
  publishLeaveRoomResult({
    roomName: roomId,
    removedUserId: "",
    targetSocketIds: allSocketIds,
    broadcasts: [destroyedBroadcast],
    destroyed: true,
  });

  return {
    recordId,
    roomId,
    endedAt,
  };
}
