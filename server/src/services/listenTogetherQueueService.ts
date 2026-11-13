import { ListenTogetherError, type ListenTogetherRoom } from "../realtime/listenTogether/listenTogetherTypes";
import { normalizeSong } from "../realtime/listenTogether/listenTogetherValidator";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 只转发协议 DTO；队列不落库，歌曲统一去除取链结果和本机路径。 */
export function normalizeListenTogetherQueueData(
  value: unknown,
  room: ListenTogetherRoom,
  userId: string,
): Record<string, unknown> {
  const data = record(value) ? value : {};
  const kind = data.kind;
  const isHost = room.hostUserId === userId;
  if (!["SNAPSHOT_REQUEST", "SNAPSHOT_CHUNK", "QUEUE_COMMAND", "QUEUE_DELTA"].includes(String(kind))) {
    throw new ListenTogetherError("队列事件不合法", "INVALID_SONG", 400);
  }
  if (((kind === "SNAPSHOT_CHUNK" || kind === "QUEUE_DELTA") && !isHost)
      || (kind === "QUEUE_COMMAND" && !isHost && !room.memberOperation)) {
    throw new ListenTogetherError("无队列操作权限", "NO_PERMISSION", 403);
  }
  const result: Record<string, unknown> = { kind };
  for (const key of ["targetUserId", "snapshotId", "currentItemId", "queueItemId", "transitionId"]) {
    if (typeof data[key] === "string") result[key] = data[key].slice(0, 128);
    else if (data[key] === null) result[key] = null;
  }
  for (const key of ["queueVersion", "total", "chunkIndex", "chunkCount"]) {
    if (typeof data[key] === "number" && Number.isSafeInteger(data[key]) && data[key] >= 0) {
      result[key] = data[key];
    }
  }
  if (kind === "QUEUE_COMMAND") {
    if (!["ADD_AND_PLAY", "PLAY_ITEM", "REMOVE_ITEM", "NEXT", "PREVIOUS"].includes(String(data.command))) {
      throw new ListenTogetherError("队列命令不合法", "INVALID_SONG", 400);
    }
    result.command = data.command;
    if (data.command === "ADD_AND_PLAY") result.song = normalizeSong(data.song);
  }
  if (kind === "SNAPSHOT_CHUNK" || kind === "QUEUE_DELTA") {
    if (!Array.isArray(data.items) || (kind === "SNAPSHOT_CHUNK" && data.items.length > 200)) {
      throw new ListenTogetherError("队列数据不合法", "INVALID_SONG", 400);
    }
    result.items = data.items.map((item: unknown) => {
      if (!record(item) || typeof item.queueItemId !== "string" || !item.queueItemId) {
        throw new ListenTogetherError("队列歌曲不合法", "INVALID_SONG", 400);
      }
      return {
        queueItemId: item.queueItemId.slice(0, 128),
        song: normalizeSong(item.song),
        addedByUserId: typeof item.addedByUserId === "string" ? item.addedByUserId.slice(0, 128) : "",
        addedAt: typeof item.addedAt === "number" && Number.isFinite(item.addedAt) ? item.addedAt : 0,
      };
    });
  }
  return result;
}
