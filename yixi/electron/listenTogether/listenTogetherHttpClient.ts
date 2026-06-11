// 一起听 HTTP 客户端（main 进程）。
// 复用 systemClient 的 requestSystem/getAccountSession；错误保留服务端 code/msg/errorMsg，
// 通过 ListenTogetherHttpResult 信封返回，避免 IPC 异常序列化后 renderer 无法分类处理。

import type {
  ListenTogetherApiError,
  ListenTogetherConfig,
  ListenTogetherCreateRoomPayload,
  ListenTogetherErrorCode,
  ListenTogetherHttpResult,
  ListenTogetherRoom,
} from "../../src/types/listenTogether";
import { getAccountSession, requestSystem } from "../system/systemClient";

const SERVER_ERROR_CODES: ReadonlySet<string> = new Set([
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "ROOM_ID_EXISTS",
  "INVALID_ROOM_ID",
  "INVALID_ROOM_NAME",
  "INVALID_MAX_PEOPLE",
  "INVALID_SONG",
  "INVALID_POSITION",
  "NO_PERMISSION",
  "NOT_IN_ROOM",
  "ALREADY_IN_ROOM",
  "USER_ALREADY_HAS_ROOM",
  "TARGET_USER_NOT_FOUND",
  "HOST_CANNOT_BE_KICKED",
  "UNAUTHORIZED",
  "INTERNAL_ERROR",
]);

/** 服务端房间名上限；renderer 表单限制 2-16 字，这里只兜底协议上限 */
const ROOM_NAME_SERVER_MAX = 40;
const ROOM_ID_RE = /^\d{4,8}$/;

type ListenTogetherEnvelope<T> = {
  success: boolean;
  code: number;
  msg: string;
  data: T | null;
  errorMsg?: string;
};

function normalizeErrorCode(value: unknown): ListenTogetherErrorCode | null {
  return typeof value === "string" && SERVER_ERROR_CODES.has(value)
    ? (value as ListenTogetherErrorCode)
    : null;
}

function envelopeError(envelope: ListenTogetherEnvelope<unknown>, fallback: string): ListenTogetherApiError {
  return {
    code: envelope.code,
    msg: envelope.msg || fallback,
    errorMsg: normalizeErrorCode(envelope.errorMsg),
  };
}

function networkError(error: unknown, fallback: string): ListenTogetherApiError {
  return {
    code: -1,
    msg: error instanceof Error && error.message ? error.message : fallback,
    errorMsg: null,
  };
}

function unauthorizedError(): ListenTogetherApiError {
  return { code: 401, msg: "请先登录账号", errorMsg: "UNAUTHORIZED" };
}

export async function getListenTogetherConfig(): Promise<ListenTogetherHttpResult<ListenTogetherConfig>> {
  try {
    const response = (await requestSystem<ListenTogetherConfig>("/api/listen-together/config", {
      encrypted: false,
    })) as ListenTogetherEnvelope<ListenTogetherConfig>;
    if (!response.success || response.code !== 0 || !response.data) {
      return { ok: false, error: envelopeError(response, "读取一起听配置失败") };
    }
    return { ok: true, data: response.data };
  } catch (error) {
    return { ok: false, error: networkError(error, "读取一起听配置失败") };
  }
}

export async function createListenTogetherRoom(
  payload: ListenTogetherCreateRoomPayload,
): Promise<ListenTogetherHttpResult<ListenTogetherRoom>> {
  const session = getAccountSession();
  if (!session.loggedIn) return { ok: false, error: unauthorizedError() };

  const roomName = String(payload.roomName ?? "").trim().slice(0, ROOM_NAME_SERVER_MAX);
  if (!roomName) {
    return { ok: false, error: { code: 400, msg: "房间名不能为空", errorMsg: "INVALID_ROOM_NAME" } };
  }
  const roomId = typeof payload.roomId === "string" ? payload.roomId.trim() : "";
  if (roomId && !ROOM_ID_RE.test(roomId)) {
    return { ok: false, error: { code: 400, msg: "房间号必须是 4-8 位数字", errorMsg: "INVALID_ROOM_ID" } };
  }

  try {
    const response = (await requestSystem<{ room: ListenTogetherRoom }>("/api/listen-together/rooms", {
      method: "POST",
      body: {
        roomName,
        ...(roomId ? { roomId } : {}),
        ...(typeof payload.maxPeople === "number" ? { maxPeople: Math.floor(payload.maxPeople) } : {}),
        // 服务端缺省 memberOperation 为 true，必须显式传布尔值（默认关闭，与 PM 一致）
        memberOperation: payload.memberOperation === true,
        replaceExisting: payload.replaceExisting === true,
      },
      headers: { Authorization: `Bearer ${session.token}` },
    })) as ListenTogetherEnvelope<{ room: ListenTogetherRoom }>;
    if (!response.success || response.code !== 0 || !response.data?.room) {
      return { ok: false, error: envelopeError(response, "创建房间失败") };
    }
    return { ok: true, data: response.data.room };
  } catch (error) {
    return { ok: false, error: networkError(error, "创建房间失败") };
  }
}

export async function getListenTogetherRoom(
  roomId: string,
): Promise<ListenTogetherHttpResult<ListenTogetherRoom>> {
  const session = getAccountSession();
  if (!session.loggedIn) return { ok: false, error: unauthorizedError() };

  const cleanRoomId = String(roomId ?? "").trim();
  if (!ROOM_ID_RE.test(cleanRoomId)) {
    return { ok: false, error: { code: 400, msg: "房间号必须是 4-8 位数字", errorMsg: "INVALID_ROOM_ID" } };
  }

  try {
    const response = (await requestSystem<{ room: ListenTogetherRoom }>(
      `/api/listen-together/rooms/${encodeURIComponent(cleanRoomId)}`,
      {
        headers: { Authorization: `Bearer ${session.token}` },
      },
    )) as ListenTogetherEnvelope<{ room: ListenTogetherRoom }>;
    if (!response.success || response.code !== 0 || !response.data?.room) {
      return { ok: false, error: envelopeError(response, "查询房间失败") };
    }
    return { ok: true, data: response.data.room };
  } catch (error) {
    return { ok: false, error: networkError(error, "查询房间失败") };
  }
}
