// 一起听共享协议类型。
// 协议基线：server/src/realtime/listenTogether/* 与 pm/app/.../listen/*（两端已冻结字段）。
// 本文件被 electron main 与 renderer 共同引用，禁止引入 Vue / Electron / Node 依赖。

export type ListenTogetherStatus = "playing" | "paused" | "ended";

export type ListenTogetherMemberRole = "host" | "member";

export type ListenTogetherSongSource = "kg" | "qq" | "wy" | "kw" | "local";

/** 协议歌曲对象：duration 单位毫秒；url 仅作占位，跨端不信任对方 url */
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

/** 歌曲身份标识：PLAY/PAUSE/SEEK/ENDED 必须携带，服务端用它校验当前歌曲 */
export type ListenTogetherSongRef = {
  source: ListenTogetherSongSource;
  id: string;
};

export type ListenTogetherMember = {
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string;
  role: ListenTogetherMemberRole;
  online: boolean;
  joinedAt: number;
  lastSeenAt: number;
};

/** 服务端 publicRoom 形态（含 currentPeople）；position/updatedAt 单位毫秒 */
export type ListenTogetherRoom = {
  roomId: string;
  roomName: string;
  hostUserId: string;
  song: ListenTogetherSong | null;
  status: ListenTogetherStatus;
  position: number;
  maxPeople: number;
  currentPeople: number;
  memberOperation: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
  members: ListenTogetherMember[];
};

export type ListenTogetherConfig = {
  maxPeopleLimit: number;
  defaultMaxPeople: number;
  roomIdMinLength: number;
  roomIdMaxLength: number;
  defaultRoomIdLength: number;
};

/** 服务端定义的错误码；SOCKET_DISCONNECTED / ACK_TIMEOUT 为客户端本地补充 */
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
  | "INTERNAL_ERROR"
  | "SOCKET_DISCONNECTED"
  | "ACK_TIMEOUT";

/** HTTP 一起听接口错误（保留服务端 code/msg/errorMsg，IPC 跨进程后仍可分类处理） */
export type ListenTogetherApiError = {
  code: number;
  msg: string;
  errorMsg: ListenTogetherErrorCode | null;
};

/** HTTP IPC 统一返回信封：避免 ipcMain 异常序列化丢失 errorMsg */
export type ListenTogetherHttpResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ListenTogetherApiError };

export type ListenTogetherAck<T = unknown> =
  | { success: true; code: 0; msg: string; data: T }
  | { success: false; code: number; msg: string; errorMsg?: ListenTogetherErrorCode; data?: null };

/** join/sync ACK data */
export type ListenTogetherJoinAckData = {
  room: ListenTogetherRoom;
  serverTime: number;
};

/** play/pause/change_song/seek/ended/update_room/transfer_host ACK data */
export type ListenTogetherRoomAckData = {
  room: ListenTogetherRoom;
  transitionId?: string;
  applied: boolean;
};

/** listen:queue ACK data */
export type ListenTogetherQueueAckData = {
  serverTime: number;
};

export type ListenTogetherBroadcastEvent =
  | "ROOM_STATE_CHANGED"
  | "ROOM_UPDATED"
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "MEMBER_KICKED"
  | "HOST_TRANSFERRED"
  | "ROOM_DESTROYED"
  | "QUEUE_EVENT"
  | "ERROR_MESSAGE";

export type ListenTogetherBroadcast<T = unknown> = {
  event: ListenTogetherBroadcastEvent;
  roomId: string;
  serverTime: number;
  version: number;
  data: T;
};

export type ListenTogetherStateChangedAction = "PLAY" | "PAUSE" | "CHANGE_SONG" | "SEEK" | "ENDED";

export type ListenTogetherOperator = {
  userId: string;
  nickname: string;
};

export type ListenTogetherStateChangedData = {
  action: ListenTogetherStateChangedAction;
  room: ListenTogetherRoom;
  operator?: ListenTogetherOperator;
  transitionId?: string;
  queueItemId?: string;
};

export type ListenTogetherRoomUpdatedData = {
  room: ListenTogetherRoom;
  operator?: ListenTogetherOperator;
};

export type ListenTogetherMemberJoinedData = {
  member: ListenTogetherMember;
  members: ListenTogetherMember[];
};

export type ListenTogetherMemberLeftData = {
  userId: string;
  member?: ListenTogetherMember;
  newHostUserId?: string;
  members: ListenTogetherMember[];
};

export type ListenTogetherMemberKickedData = {
  targetUserId: string;
  operator?: ListenTogetherOperator;
  members: ListenTogetherMember[];
};

export type ListenTogetherHostTransferredData = {
  oldHostUserId: string;
  newHostUserId: string;
  members: ListenTogetherMember[];
};

export type ListenTogetherRoomDestroyedData = {
  room: ListenTogetherRoom;
  removedUserId?: string;
};

export type ListenTogetherErrorMessageData = {
  msg?: string;
};

// ---------------------------------------------------------------------------
// 房间队列协议（与 PM ListenTogetherManager 常量逐字一致；服务端只转发不解析）
// ---------------------------------------------------------------------------

export const LISTEN_TOGETHER_QUEUE_KIND = {
  snapshotRequest: "SNAPSHOT_REQUEST",
  snapshotChunk: "SNAPSHOT_CHUNK",
  command: "QUEUE_COMMAND",
  delta: "QUEUE_DELTA",
} as const;

export type ListenTogetherQueueKind =
  (typeof LISTEN_TOGETHER_QUEUE_KIND)[keyof typeof LISTEN_TOGETHER_QUEUE_KIND];

export const LISTEN_TOGETHER_QUEUE_COMMAND = {
  addAndPlay: "ADD_AND_PLAY",
  playItem: "PLAY_ITEM",
  removeItem: "REMOVE_ITEM",
  next: "NEXT",
  previous: "PREVIOUS",
} as const;

export type ListenTogetherQueueCommandName =
  (typeof LISTEN_TOGETHER_QUEUE_COMMAND)[keyof typeof LISTEN_TOGETHER_QUEUE_COMMAND];

/** 快照分片大小与块间隔，必须与 PM 一致 */
export const LISTEN_TOGETHER_QUEUE_SNAPSHOT_CHUNK_SIZE = 200;
export const LISTEN_TOGETHER_QUEUE_SNAPSHOT_CHUNK_DELAY_MS = 50;

export type ListenTogetherQueueItem = {
  queueItemId: string;
  song: ListenTogetherSong;
  addedByUserId: string;
  addedAt: number;
};

export type ListenTogetherQueueState = {
  queueVersion: number;
  currentItemId: string | null;
  items: ListenTogetherQueueItem[];
  syncing: boolean;
  snapshotId: string | null;
};

export type ListenTogetherQueueSnapshotChunk = {
  snapshotId: string;
  queueVersion: number;
  total: number;
  chunkIndex: number;
  chunkCount: number;
  currentItemId: string | null;
  items: ListenTogetherQueueItem[];
};

export type ListenTogetherQueueDelta = {
  queueVersion: number;
  currentItemId: string | null;
  items: ListenTogetherQueueItem[];
};

export type ListenTogetherQueueCommand = {
  command: ListenTogetherQueueCommandName;
  queueItemId?: string | null;
  song?: ListenTogetherSong | null;
  transitionId?: string | null;
};

/** 收到的 QUEUE_EVENT data：服务端注入 fromUserId，按 kind 区分内容 */
export type ListenTogetherQueueEventData = {
  kind?: string;
  fromUserId?: string;
  targetUserId?: string;
} & Partial<ListenTogetherQueueSnapshotChunk> &
  Partial<ListenTogetherQueueCommand> &
  Partial<ListenTogetherQueueDelta>;

// ---------------------------------------------------------------------------
// IPC 契约（renderer ↔ main）
// ---------------------------------------------------------------------------

export type ListenTogetherCreateRoomPayload = {
  roomName: string;
  roomId?: string;
  maxPeople?: number;
  /** 服务端缺省为 true，客户端必须显式传值（默认 false 与 PM 对齐） */
  memberOperation: boolean;
  replaceExisting?: boolean;
};

/** renderer 允许发送的 socket 命令联合类型（preload/main 用它收敛事件名与 payload） */
export type ListenTogetherSocketCommand =
  | { type: "join"; roomId: string }
  | { type: "leave"; roomId: string }
  | { type: "sync"; roomId: string }
  | {
      type: "play";
      roomId: string;
      song: ListenTogetherSong;
      position: number;
      transitionId?: string;
    }
  | {
      type: "pause";
      roomId: string;
      songRef: ListenTogetherSongRef;
      position: number;
      transitionId?: string;
    }
  | {
      type: "changeSong";
      roomId: string;
      song: ListenTogetherSong;
      autoPlay: boolean;
      transitionId?: string;
      queueItemId?: string | null;
    }
  | {
      type: "seek";
      roomId: string;
      songRef: ListenTogetherSongRef;
      position: number;
      transitionId?: string;
    }
  | {
      type: "ended";
      roomId: string;
      songRef: ListenTogetherSongRef;
      position: number;
      transitionId?: string;
    }
  | {
      type: "updateRoom";
      roomId: string;
      roomName?: string;
      maxPeople?: number;
      memberOperation?: boolean;
    }
  | {
      type: "queue";
      roomId: string;
      kind: ListenTogetherQueueKind;
      targetUserId?: string;
      data?: Record<string, unknown>;
    }
  | { type: "kickMember"; roomId: string; targetUserId: string }
  | { type: "transferHost"; roomId: string; targetUserId: string };

/** socket 命令返回：ACK + 该次 emit 的真实 RTT（ACK 往返耗时，毫秒） */
export type ListenTogetherCommandResult<T = unknown> = {
  ack: ListenTogetherAck<T>;
  rttMs: number | null;
};

/** main 推送给 renderer 的连接状态事件 */
export type ListenTogetherConnectionEvent =
  | { type: "connected" }
  | { type: "disconnected"; reason: string }
  | { type: "connect-error"; message: string }
  | { type: "latency"; latencyMs: number };
