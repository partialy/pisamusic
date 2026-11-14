import type { PlaylistSnapshot, TrackSnapshot } from "./types";

export type LibraryItemType = "favorite_song" | "favorite_playlist" | "user_playlist";
export type LibraryScope = Readonly<{ accountId: string; deviceIdentity: string }>;
export type LibraryWriteOptions = { fromSync?: boolean };
export type TrackWriteOptions = LibraryWriteOptions & { sortOrder?: number | null; serverVersion?: number };
export type SyncOperationInput = { itemType: string; itemKey: string; action: "upsert" | "delete"; payload?: unknown };
export function captureLibraryScope(scope: LibraryScope): LibraryScope {
  if (typeof scope.accountId !== "string" || typeof scope.deviceIdentity !== "string") throw new Error("需要 main 可信账号与设备上下文");
  if (scope.accountId && !scope.deviceIdentity) throw new Error("账号写入需要长期设备身份");
  return Object.freeze({ accountId: scope.accountId, deviceIdentity: scope.deviceIdentity });
}
export function validateSortOrder(value: number | null | undefined) {
  if (value !== undefined && value !== null && (!Number.isSafeInteger(value) || value < 0)) throw new Error("非法曲目排序");
}
export function onlineCover(track: TrackSnapshot) {
  if (track.source === "local" || !track.cover) return false;
  try {
    const url = new URL(track.cover.replaceAll("{size}", "480"));
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
export function publicPlaylist(playlist: PlaylistSnapshot) {
  const result = { ...playlist };
  if (result.cover && !/^https?:\/\//i.test(result.cover)) result.cover = "";
  return result;
}
/** 此处只产生安全源字段；最终协议组装仍交由 sync 层白名单模块。 */
export function publicTrack(track: TrackSnapshot, syncId?: string): Record<string, unknown> {
  const id = syncId ?? track.id;
  const result: Record<string, unknown> = { id, source: track.source, urlParam: track.source === "local" ? id : track.urlParam ?? id };
  for (const key of ["name", "singer", "album"] as const) {
    const value = track[key] ?? "";
    if (track.source === "local" && (value.length > 512 || /^(?:[a-z]:[\\/]|[\\/]|(?:file|content):|[a-z][a-z\d+.-]*:\/\/)/i.test(value))) {
      throw new Error("本地曲目公开元信息包含私有位置或超长字段");
    }
    result[key] = value;
  }
  result.duration = Math.max(0, Number.isFinite(track.duration) ? track.duration! : 0);
  if (track.source === "local") {
    // 旧 LOCAL duration 单位混杂，禁止阈值推断；新生产者传显式毫秒。
    result.duration = track.durationMs ?? 0;
    if (track.durationMs !== undefined) result.durationMs = track.durationMs;
    result.cover = safeLocalCover(track.cover ?? "") ? track.cover : "";
  } else result.cover = track.cover ?? "";
  if (track.favoritedAt !== undefined && track.source !== "local") result.favoritedAt = track.favoritedAt;
  return result;
}
function safeLocalCover(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return value.length <= 2048 && url.protocol === "https:" && !url.username && !url.password && !url.hash
      && [...url.searchParams].every(([key, v]) => /^(param|thumbnail|w|h|width|height|size|quality|q)$/.test(key)
        && /^\d{1,5}(?:[xy_/*]\d{1,5})?!?$/.test(v));
  } catch { return false; }
}
