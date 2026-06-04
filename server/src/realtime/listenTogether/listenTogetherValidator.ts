import {
  LISTEN_TOGETHER_DEFAULT_ROOM_ID_LENGTH,
  LISTEN_TOGETHER_ROOM_ID_MAX_LENGTH,
  LISTEN_TOGETHER_ROOM_ID_MIN_LENGTH,
  ListenTogetherError,
  type ListenTogetherSong,
  type ListenTogetherSongSource,
} from "./listenTogetherTypes";

const ROOM_ID_RE = /^\d{4,8}$/;
const SONG_SOURCES: readonly ListenTogetherSongSource[] = ["kg", "qq", "wy", "kw", "local"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function optionalString(value: unknown, maxLength: number): string {
  return stringValue(value, maxLength);
}

function numberValue(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function validateRoomName(value: unknown): string {
  const roomName = stringValue(value, 40);
  if (!roomName) {
    throw new ListenTogetherError("房间名不能为空", "INVALID_ROOM_NAME", 400);
  }
  return roomName;
}

export function normalizeOptionalRoomId(value: unknown): string | null {
  const roomId = typeof value === "string" ? value.trim() : "";
  if (!roomId) return null;
  if (!ROOM_ID_RE.test(roomId)) {
    throw new ListenTogetherError("房间号必须是 4-8 位数字", "INVALID_ROOM_ID", 400);
  }
  return roomId;
}

export function validateRoomId(value: unknown): string {
  const roomId = normalizeOptionalRoomId(value);
  if (!roomId) {
    throw new ListenTogetherError("房间号不能为空", "INVALID_ROOM_ID", 400);
  }
  return roomId;
}

export function generateRoomId(): string {
  const min = 10 ** (LISTEN_TOGETHER_DEFAULT_ROOM_ID_LENGTH - 1);
  const max = 10 ** LISTEN_TOGETHER_DEFAULT_ROOM_ID_LENGTH - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

export function normalizeMaxPeople(value: unknown, limit: number): number {
  const raw = value === undefined || value === null || value === "" ? 2 : Math.floor(Number(value));
  if (!Number.isFinite(raw) || raw < 2 || raw > limit) {
    throw new ListenTogetherError(`房间人数必须在 2-${limit} 之间`, "INVALID_MAX_PEOPLE", 400);
  }
  return raw;
}

export function normalizeMemberOperation(value: unknown): boolean {
  return value === undefined || value === null ? true : Boolean(value);
}

export function normalizePosition(value: unknown, duration?: number): number {
  const position = Math.floor(numberValue(value, 0));
  if (position < 0) {
    throw new ListenTogetherError("播放进度不合法", "INVALID_POSITION", 400);
  }
  if (duration && duration > 0 && position > duration) {
    throw new ListenTogetherError("播放进度不能超过歌曲时长", "INVALID_POSITION", 400);
  }
  return position;
}

export function normalizeSong(value: unknown): ListenTogetherSong {
  if (!isRecord(value)) {
    throw new ListenTogetherError("歌曲对象不合法", "INVALID_SONG", 400);
  }
  const id = stringValue(value.id, 128);
  const source = stringValue(value.source, 16) as ListenTogetherSongSource;
  const name = stringValue(value.name, 200);
  const singer = stringValue(value.singer, 200);
  if (!id || !source || !name || !singer || !SONG_SOURCES.includes(source)) {
    throw new ListenTogetherError("歌曲对象缺少必要字段", "INVALID_SONG", 400);
  }
  const duration = Math.max(0, Math.floor(numberValue(value.duration, 0)));
  const coverSize = isRecord(value.coverSize)
    ? {
        s: optionalString(value.coverSize.s, 500),
        m: optionalString(value.coverSize.m, 500),
        l: optionalString(value.coverSize.l, 500),
        xl: optionalString(value.coverSize.xl, 500),
      }
    : undefined;
  const size = isRecord(value.size)
    ? Object.fromEntries(
        Object.entries(value.size)
          .map(([key, item]) => [key, Number(item)] as const)
          .filter(([key, item]) => key.length > 0 && Number.isFinite(item)),
      )
    : undefined;

  return {
    id,
    source,
    urlParam: optionalString(value.urlParam, 500) || id,
    name,
    singer,
    album: optionalString(value.album, 200),
    cover: optionalString(value.cover, 1000),
    ...(coverSize ? { coverSize } : {}),
    url: optionalString(value.url, 2000),
    duration,
    ...(typeof value.vip === "boolean" ? { vip: value.vip } : {}),
    ...(size ? { size } : {}),
    ...(typeof value.filePath === "string" ? { filePath: optionalString(value.filePath, 2000) } : {}),
  };
}

export function roomIdRule() {
  return {
    roomIdMinLength: LISTEN_TOGETHER_ROOM_ID_MIN_LENGTH,
    roomIdMaxLength: LISTEN_TOGETHER_ROOM_ID_MAX_LENGTH,
    defaultRoomIdLength: LISTEN_TOGETHER_DEFAULT_ROOM_ID_LENGTH,
  };
}
