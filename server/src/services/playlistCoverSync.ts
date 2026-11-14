import type { DbTransaction } from "../db/core/types";
import type { SyncChangeInput } from "../db/syncStore";
import { lockCover, type CoverResource } from "../db/playlistCoverStore";
import { readFileRecordByIdWithDb } from "../db/files/fileRecordStore";
import { SyncValidationError } from "./syncPayloadPolicy";

/** 在 sync 的同一用户锁事务内处理最终胜出项，不能用客户端 object key 或提前修改权威歌单。 */
export async function normalizeCoverChanges(tx: DbTransaction, userId: string, changes: Iterable<SyncChangeInput>): Promise<void> {
  const playlists = [...changes].filter(c => c.itemType === "user_playlist");
  const resourceIds = [...new Set(playlists.flatMap(c => {
    const p = c.payload as {coverResource?: {resourceId:string}|null};
    return c.action === "upsert" && p?.coverResource ? [p.coverResource.resourceId] : [];
  }))].sort();
  const resources = new Map<string,CoverResource>();
  for (const id of resourceIds) {
    const resource = await lockCover(tx,id);
    if (!resource || resource.owner_user_id !== userId || resource.state !== "ready") throw new SyncValidationError("coverResource 不存在、跨账号或已失效，请从本地副本重新上传");
    const file = await readFileRecordByIdWithDb(tx,resource.file_record_id);
    if (!file || file.status !== "uploaded") throw new SyncValidationError("coverResource 对象不可引用，请重新上传");
    resources.set(id,resource);
  }
  for (const c of playlists) {
    const p = c.payload as Record<string,unknown>;
    const resource = p?.coverResource as {resourceId:string}|null|undefined;
    if (c.action === "upsert" && resource) {
      if (p.coverPreset != null) throw new SyncValidationError("coverResource 与 coverPreset 不能同时设置");
      p.cover = resources.get(resource.resourceId)!.public_url;
    }
  }
}
