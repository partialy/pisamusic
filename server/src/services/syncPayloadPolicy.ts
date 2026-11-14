import type { SyncChangeInput } from "../db/syncStore";

export class SyncValidationError extends Error {}
type Payload = Record<string, unknown>;
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const localId = new RegExp(`^${uuid}:${uuid}$`, "i");
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/;
const localFields = new Set(["source", "id", "urlParam", "name", "singer", "album", "duration", "cover", "sortOrder"]);

export function playlistId(itemKey: string): string | null {
  const separator = itemKey.indexOf("|");
  return separator > 0 ? itemKey.slice(0, separator) : null;
}

/** 仅保护明确约定的扩展；基础字段仍整份替换，墓碑不继承字段。 */
export function mergeSyncPayload(change: SyncChangeInput, previous?: unknown): Payload {
  if (change.action === "delete") return {};
  const payload = { ...(change.payload as Payload ?? {}) };
  const old = previous as Payload | undefined;
  const fields = change.itemType === "user_playlist" ? ["coverResource", "coverPreset"]
    : change.itemType === "playlist_track" ? ["sortOrder"] : [];
  for (const field of fields)
    if (!Object.prototype.hasOwnProperty.call(payload, field) && old && Object.prototype.hasOwnProperty.call(old, field)) payload[field] = old[field];
  validateSyncPayload({ ...change, payload });
  return payload;
}

export function validateSyncPayload(change: SyncChangeInput): void {
  if (change.action === "delete") return;
  const p = change.payload as Payload;
  if (change.itemType === "playlist_track" && p.sortOrder !== undefined && p.sortOrder !== null
    && (typeof p.sortOrder !== "number" || !Number.isSafeInteger(p.sortOrder) || p.sortOrder < 0))
    throw new SyncValidationError("sortOrder 必须是非负安全整数或 null");
  if (change.itemType === "user_playlist") {
    if (p.coverPreset !== undefined && p.coverPreset !== null
      && (typeof p.coverPreset !== "string" || !identifier.test(p.coverPreset)))
      throw new SyncValidationError("coverPreset 必须是 1～128 字符的稳定标识或 null");
    if (p.coverResource !== undefined && p.coverResource !== null) {
      const resource = p.coverResource as Payload;
      if (typeof resource !== "object" || Array.isArray(resource) || Object.keys(resource).length !== 1
        || typeof resource.resourceId !== "string" || !identifier.test(resource.resourceId))
        throw new SyncValidationError("coverResource 仅允许 1～128 字符的 resourceId 或 null");
    }
  }
  const localKey = change.itemType === "playlist_track" && change.itemKey.includes("|local:");
  if (p.source !== "local" && !localKey) return;
  // 自建歌单本身 source=local 是历史合法 DTO，不属于本地歌曲占位。
  if (change.itemType === "user_playlist" || change.itemType === "favorite_playlist") return;
  if (change.itemType !== "playlist_track" || p.source !== "local" || typeof p.id !== "string"
    || !localId.test(p.id) || p.urlParam !== p.id || !playlistId(change.itemKey)
    || change.itemKey !== `${playlistId(change.itemKey)}|local:${p.id}`)
    throw new SyncValidationError("LOCAL 仅允许自建歌单内稳定 UUID 占位");
  for (const [field, value] of Object.entries(p)) {
    if (!localFields.has(field)) throw new SyncValidationError(`LOCAL 不允许字段 ${field}`);
    if (["name", "singer", "album"].includes(field)
      && (typeof value !== "string" || value.length > 512 || /(?:[a-z]:[\\/]|file:|content:|https?:|[/\\])/i.test(value)))
      throw new SyncValidationError(`LOCAL ${field} 必须是无路径的公开文本`);
  }
  if (p.duration !== undefined && (typeof p.duration !== "number" || !Number.isFinite(p.duration) || p.duration < 0))
    throw new SyncValidationError("LOCAL duration 必须是非负有限数值");
  if (p.cover !== undefined && p.cover !== "") {
    try {
      if (typeof p.cover !== "string" || p.cover.length > 2048) throw new Error();
      const url = new URL(p.cover);
      const publicSizes = new Set(["param", "thumbnail", "w", "h", "width", "height", "size", "quality", "q"]);
      if ([...url.searchParams].some(([name, value]) => !publicSizes.has(name)
        || !/^\d{1,5}(?:[xy_*]\d{1,5})?!?$/.test(value))) throw new Error();
      if (url.protocol !== "https:" || url.username || url.password || url.hash
        || !url.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)
        || url.hostname.endsWith(".local") || url.hostname.endsWith(".localhost")) throw new Error();
    } catch { throw new SyncValidationError("LOCAL cover 必须是无凭据的公共 HTTPS URL（仅允许公开尺寸参数）或空字符串"); }
  }
}
