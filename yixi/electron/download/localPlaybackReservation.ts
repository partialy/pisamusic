import { randomUUID } from "node:crypto";
import { acquireFileLock } from "./downloadFileLocks";
import type { TrackSnapshot } from "../database/types";

type Reservation = { key: string; token: string; lease: Awaited<ReturnType<typeof acquireFileLock>>; timer?: ReturnType<typeof setTimeout> };
const pending = new Map<string, Reservation>();
let current: Reservation | undefined;
const songKey = (song: Pick<TrackSnapshot, "id" | "source">) => `${song.source}:${song.id}`;
function tokenOf(song: Partial<TrackSnapshot> | null) {
  try { return new URL(String(song?.url || "")).searchParams.get("pisaPlayback") || ""; } catch { return ""; }
}

/** 仅由 main 可信 LOCAL 解析结果调用；取链返回前即持有共享锁。 */
export async function reserveLocalPlayback(song: TrackSnapshot, filePath: string) {
  const key = songKey(song);
  const lease = await acquireFileLock(filePath, `playback:${randomUUID()}`, "shared");
  const token = randomUUID();
  const reservation: Reservation = { key, token, lease };
  pending.set(token, reservation);
  reservation.timer = setTimeout(() => {
    if (pending.get(token) === reservation) { pending.delete(token); lease.release(); }
  }, 60_000);
  return token;
}

/** 当前曲目发布才交接；暂停事件不释放，renderer 的任意 filePath 不构成占用。 */
export function publishPlaybackSong(song: TrackSnapshot | null) {
  const key = song?.source === "local" ? songKey(song) : "";
  const token = tokenOf(song);
  const next = pending.get(token);
  if (next && next.key === key) {
    pending.delete(token); clearTimeout(next.timer);
    current?.lease.release(); current = next;
  } else if (current?.key !== key) { current?.lease.release(); current = undefined; }
  // 其他未返回的 prepare 留到显式取消或超时，不能把异步读取空窗暴露给删除。
}
export function commitLocalPlayback(song: TrackSnapshot) {
  if (song?.source !== "local") return;
  const reservation = pending.get(tokenOf(song));
  if (!reservation || reservation.key !== songKey(song)) throw new Error("本地播放预留已失效，请重新播放");
  clearTimeout(reservation.timer);
}
export function releasePlaybackSong(song: Pick<TrackSnapshot, "id" | "source"> & { url?: string } | null) {
  if (!song || typeof song.id !== "string" || song.source !== "local") return;
  const key = songKey(song);
  const token = tokenOf(song);
  const reservation = pending.get(token);
  if (reservation?.key === key) { clearTimeout(reservation.timer); reservation.lease.release(); pending.delete(token); }
  if (current?.key === key && current.token === token) { current.lease.release(); current = undefined; }
}
export function clearLocalPlaybackReservations() {
  current?.lease.release(); current = undefined;
  for (const reservation of pending.values()) { clearTimeout(reservation.timer); reservation.lease.release(); }
  pending.clear();
}
