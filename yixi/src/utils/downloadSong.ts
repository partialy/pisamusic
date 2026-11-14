import type { DownloadSongInput } from "../types/download";
import type { TrackSnapshot } from "../../electron/database/types";
const text = (value: unknown) => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
/** 下载快照只保留取链身份和元数据，不携带播放 URL、本机路径或任意嵌套对象。 */
export function toSafeDownloadSong(input: DownloadSongInput): TrackSnapshot {
  if (!input || typeof input !== "object") throw new Error("无效下载歌曲");
  const id=text(input.id),source=text(input.source),urlParam=text(input.urlParam)||id;
  if (!id || !source || [id,urlParam].some(value => value.length > 512 || /[\\/:\r\n]/.test(value))) throw new Error("歌曲取链身份无效");
  const song: TrackSnapshot={ id,source,urlParam,name:text(input.name),singer:text(input.singer),album:text(input.album),cover:text(input.cover) };
  if (typeof input.duration === "number" && Number.isFinite(input.duration)) song.duration=input.duration;
  if (typeof input.durationMs === "number" && Number.isSafeInteger(input.durationMs) && input.durationMs >= 0) song.durationMs=input.durationMs;
  for (const key of ["d_cover","lyric","krc"] as const) { const value=text(input[key]); if (value) song[key]=value; }
  if (typeof input.vip === "boolean") song.vip=input.vip;
  if (input.coverSize && typeof input.coverSize === "object") {
    const covers: Record<string,string>={};
    for (const key of ["s","m","l","xl"]) { const value=text((input.coverSize as Record<string,unknown>)[key]); if (value) covers[key]=value; }
    song.coverSize=covers;
  }
  if (input.size && typeof input.size === "object") {
    const sizes: Record<string,number>={};
    for (const [key,value] of Object.entries(input.size)) if (/^[a-z0-9_-]{1,32}$/i.test(key) && typeof value === "number" && Number.isFinite(value) && value >= 0) sizes[key]=value;
    song.size=sizes;
  }
  return song;
}
