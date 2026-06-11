// 一起听同步纯规则：无副作用、不依赖 Vue / Electron，可被状态机与单元测试直接复用。
// 行为与 PM ListenTogetherSyncRules / ListenTogetherManager 中的对应规则保持一致。

import type {
  ListenTogetherRoom,
  ListenTogetherStateChangedAction,
} from "../types/listenTogether";

/** 房主心跳间隔，与 PM HOST_HEARTBEAT_INTERVAL_MS 一致 */
export const HOST_HEARTBEAT_INTERVAL_MS = 6_000;

/** 切歌 UI 防抖兜底时长，与 PM TRANSITION_DEBOUNCE_MS 一致；不代替 ACK/广播结束 pending */
export const TRANSITION_DEBOUNCE_MS = 450;

/** 远端同步完成后延迟解除抑制，吸收 Howler 异步事件回流 */
export const REMOTE_SYNC_RELEASE_DELAY_MS = 250;

/** 同一歌曲进度偏差超过该值才执行 seek，避免高频追赶 */
export const SEEK_TOLERANCE_MS = 1_000;

/**
 * 按服务端房间状态推算目标进度（毫秒）。
 * playing 状态以 updatedAt 为基准累加流逝时间；paused/ended 不累加。
 */
export function targetPositionMs(
  room: Pick<ListenTogetherRoom, "status" | "position" | "updatedAt">,
  nowMs: number,
): number {
  const base = Math.max(0, room.position);
  if (room.status !== "playing") return base;
  return base + Math.max(0, nowMs - room.updatedAt);
}

/** 广播版本过滤：旧版本（version < lastVersion）忽略 */
export function shouldApplyBroadcastVersion(version: number, lastVersion: number): boolean {
  return version >= lastVersion;
}

/** ACK 中的房间版本不小于本地版本时才允许覆盖本地房间状态 */
export function shouldApplyAckRoom(roomVersion: number, lastVersion: number): boolean {
  return roomVersion >= lastVersion;
}

/**
 * 只有匹配当前 pending 的 CHANGE_SONG 才能结束切歌 pending；
 * PLAY/PAUSE/SEEK/ENDED 一律不能。与 PM shouldCompleteTransition 一致。
 */
export function shouldCompleteTransition(
  action: ListenTogetherStateChangedAction | string,
  pendingTransitionId: string | null,
  incomingTransitionId: string | null | undefined,
): boolean {
  return (
    action === "CHANGE_SONG" &&
    !!pendingTransitionId &&
    pendingTransitionId === incomingTransitionId
  );
}

/** 播放器秒 → 协议毫秒（取整并裁剪负值） */
export function playerSecondsToProtocolMs(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.floor(seconds * 1000));
}

/** 协议毫秒 → 播放器秒（裁剪负值，保留小数精度） */
export function protocolMsToPlayerSeconds(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, ms) / 1000;
}

/** 同一歌曲下是否需要 seek：偏差大于容差才追赶 */
export function needsSeek(
  currentMs: number,
  targetMs: number,
  toleranceMs: number = SEEK_TOLERANCE_MS,
): boolean {
  return Math.abs(currentMs - targetMs) > toleranceMs;
}

/** 发送进度时把超过歌曲时长的值裁剪到时长内，避免服务端 INVALID_POSITION */
export function clampPositionMs(positionMs: number, durationMs: number): number {
  const safe = Math.max(0, Math.floor(positionMs));
  if (durationMs > 0 && safe > durationMs) return durationMs;
  return safe;
}
