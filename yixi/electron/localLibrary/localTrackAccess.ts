import { accessSync, constants, statSync } from "node:fs";
import { getAppDatabase } from "../database";
import type { TrackSnapshot } from "../database/types";
import type { AccountLibraryRepository } from "../database/accountLibraryRepository";
export const LOCAL_SYNC_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** 每次操作捕获同一份 main 索引；只信任索引、完成下载和显式映射。 */
export function createLocalTrackResolver(repo: AccountLibraryRepository) {
  const db = getAppDatabase();
  const scanned = new Map(db.listLocalSongs().map(item => [item.id, item]));
  const downloaded = new Map(db.listDownloadedSongs().map(item => [item.id, item]));
  return (track: TrackSnapshot): TrackSnapshot => {
    if (track.source !== "local") return track;
    const mapping = LOCAL_SYNC_ID.test(track.id) ? repo.identities.findBySyncId(track.id) : repo.identities.find(`local:${track.id}`);
    const keys = mapping ? repo.identities.listLocalKeys(mapping.sync_track_id).map(key => key.slice(6)) : [track.id];
    const canonicalId = mapping ? mapping.local_song_key.slice(6) : track.id;
    for (const key of keys) {
      const local = scanned.get(key);
      const candidate = local ? { ...local.payload, id: local.id, source: "local", filePath: local.filePath, durationMs: local.duration * 1000 } : downloaded.get(key);
      const filePath = candidate?.filePath;
      if (!filePath) continue;
      try {
        accessSync(filePath, constants.R_OK);
        if (statSync(filePath).isFile()) return { ...track, ...candidate, id: canonicalId, urlParam: filePath, playable: true };
      } catch { /* 文件缺失只降级占位，不删除关系或映射；继续检查显式别名。 */ }
    }
    const { filePath: _path, url: _url, ...placeholder } = track;
    return { ...placeholder, urlParam: track.id, playable: false };
  };
}
export function resolveLocalTrack(track: TrackSnapshot, repo: AccountLibraryRepository): TrackSnapshot {
  return track.source === "local" ? createLocalTrackResolver(repo)(track) : track;
}
export const prepareLibraryTrack = resolveLocalTrack;
export function prepareLibraryTracks(tracks: TrackSnapshot[], repo: AccountLibraryRepository) {
  return tracks.some(track => track.source === "local") ? tracks.map(createLocalTrackResolver(repo)) : tracks;
}
