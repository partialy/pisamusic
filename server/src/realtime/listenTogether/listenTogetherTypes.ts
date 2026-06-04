import type { PublicUser } from "../../db/userStore";

export const LISTEN_TOGETHER_ROOM_PREFIX = "listen:";

export const LISTEN_TOGETHER_CONFIG_ID = "listen_together_max_people";
export const LISTEN_TOGETHER_MIN_PEOPLE = 2;
export const LISTEN_TOGETHER_MAX_PEOPLE = 8;
export const LISTEN_TOGETHER_DEFAULT_MAX_PEOPLE = 2;
export const LISTEN_TOGETHER_ROOM_ID_MIN_LENGTH = 4;
export const LISTEN_TOGETHER_ROOM_ID_MAX_LENGTH = 8;
export const LISTEN_TOGETHER_DEFAULT_ROOM_ID_LENGTH = 6;
export const LISTEN_TOGETHER_OFFLINE_GRACE_MS = 30_000;

export type ListenTogetherStatus = "playing" | "paused" | "ended";
export type ListenTogetherMemberRole = "host" | "member";
export type ListenTogetherSongSource = "kg" | "qq" | "wy" | "kw" | "local";

export type ListenTogetherSong = {
  id: string;
  source: ListenTogetherSongSource;
  urlParam: string;
  name: string;
  singer: string;
  album: string;
  cover: string;
  coverSize?: {
    s: string;
    m: string;
    l: string;
    xl: string;
  };
  url: string;
  duration: number;
  vip?: boolean;
  size?: Record<string, number>;
  filePath?: string;
};

export type ListenTogetherSocketUser = {
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string;
};

export type ListenTogetherMember = ListenTogetherSocketUser & {
  recordId?: string;
  role: ListenTogetherMemberRole;
  online: boolean;
  joinedAt: number;
  lastSeenAt: number;
};

export type ListenTogetherRoom = {
  recordId?: string;
  roomId: string;
  roomName: string;
  hostUserId: string;
  song: ListenTogetherSong | null;
  status: ListenTogetherStatus;
  position: number;
  maxPeople: number;
  memberOperation: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
  members: ListenTogetherMember[];
};

export type ListenTogetherPublicRoom = ListenTogetherRoom & {
  currentPeople: number;
};

export type ListenTogetherConfig = {
  maxPeopleLimit: number;
  defaultMaxPeople: number;
  roomIdMinLength: number;
  roomIdMaxLength: number;
  defaultRoomIdLength: number;
};

export type ListenTogetherCreateRoomInput = {
  roomName?: unknown;
  roomId?: unknown;
  maxPeople?: unknown;
  memberOperation?: unknown;
};

export type ListenTogetherSocketPayload<TData = Record<string, unknown>> = {
  requestId?: unknown;
  roomId?: unknown;
  action?: unknown;
  data?: TData;
};

export type ListenTogetherAck<T = unknown> =
  | {
      success: true;
      code: 0;
      msg: string;
      data: T;
    }
  | {
      success: false;
      code: number;
      msg: string;
      errorMsg: ListenTogetherErrorCode;
      data?: null;
    };

export type ListenTogetherBroadcastEvent =
  | "ROOM_STATE_CHANGED"
  | "ROOM_UPDATED"
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "MEMBER_KICKED"
  | "HOST_TRANSFERRED"
  | "ROOM_DESTROYED"
  | "ERROR_MESSAGE";

export type ListenTogetherBroadcast<T = unknown> = {
  event: ListenTogetherBroadcastEvent;
  roomId: string;
  serverTime: number;
  version: number;
  data: T;
};

export type ListenTogetherErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_ID_EXISTS"
  | "INVALID_ROOM_ID"
  | "INVALID_ROOM_NAME"
  | "INVALID_MAX_PEOPLE"
  | "INVALID_SONG"
  | "INVALID_POSITION"
  | "NO_PERMISSION"
  | "NOT_IN_ROOM"
  | "ALREADY_IN_ROOM"
  | "USER_ALREADY_HAS_ROOM"
  | "TARGET_USER_NOT_FOUND"
  | "HOST_CANNOT_BE_KICKED"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export class ListenTogetherError extends Error {
  readonly statusCode: number;
  readonly errorMsg: ListenTogetherErrorCode;

  constructor(message: string, errorMsg: ListenTogetherErrorCode, statusCode = 400) {
    super(message);
    this.name = "ListenTogetherError";
    this.errorMsg = errorMsg;
    this.statusCode = statusCode;
  }
}

export function listenRoomName(roomId: string): string {
  return `${LISTEN_TOGETHER_ROOM_PREFIX}${roomId}`;
}

export function userFromPublicUser(user: PublicUser): ListenTogetherSocketUser {
  return {
    userId: user.id,
    username: user.username,
    nickname: user.username,
    avatarUrl: user.avatarUrl || user.avatar,
  };
}
