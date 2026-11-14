import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type LocalSyncIdentity = { local_song_key: string; sync_track_id: string; device_scope_uuid: string; local_song_uuid: string };

/** 私有映射与扫描库生命周期独立，不通过标题或时长猜测文件身份。 */
export class LocalTrackIdentityRepository {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) { this.db = db; }
  find(localSongKey: string): LocalSyncIdentity | null {
    return this.db.prepare("SELECT * FROM local_sync_track_map WHERE local_song_key = COALESCE((SELECT canonical_song_key FROM local_sync_track_alias WHERE local_song_key = ?), ?)").get(localSongKey, localSongKey) as LocalSyncIdentity | undefined ?? null;
  }
  findBySyncId(syncId: string): LocalSyncIdentity | null {
    return this.db.prepare("SELECT * FROM local_sync_track_map WHERE sync_track_id = ?").get(syncId) as LocalSyncIdentity | undefined ?? null;
  }
  /** 仅用于明确确认的文件移动/播放键迁移；不覆盖已有不同逻辑身份。 */
  associateLocalKey(localSongKey: string, syncId: string): LocalSyncIdentity {
    if (!localSongKey) throw new Error("缺少本机歌曲键");
    const target = this.findBySyncId(syncId);
    if (!target) throw new Error("目标稳定身份尚未在本机建立");
    const previous = this.find(localSongKey);
    if (previous && previous.sync_track_id !== syncId) throw new Error("本机歌曲键已关联其他稳定身份");
    if (!previous) this.db.prepare("INSERT INTO local_sync_track_alias VALUES (?, ?)").run(localSongKey, target.local_song_key);
    return this.find(localSongKey)!;
  }
  listLocalKeys(syncId: string): string[] {
    const target = this.findBySyncId(syncId);
    if (!target) return [];
    const aliases = this.db.prepare("SELECT local_song_key FROM local_sync_track_alias WHERE canonical_song_key = ?")
      .all(target.local_song_key) as { local_song_key: string }[];
    return [target.local_song_key, ...aliases.map(item => item.local_song_key)];
  }
  ensure(localSongKey: string, deviceIdentity: string): LocalSyncIdentity {
    if (!localSongKey || !deviceIdentity) throw new Error("稳定本地映射需要歌曲键与长期设备身份");
    const existing = this.find(localSongKey);
    if (existing) return existing;
    this.db.prepare("INSERT OR IGNORE INTO local_sync_device_map VALUES (?, ?)")
      .run(deviceIdentity, UUID.test(deviceIdentity) ? deviceIdentity.toLowerCase() : randomUUID());
    const scope = this.db.prepare("SELECT device_scope_uuid FROM local_sync_device_map WHERE device_identity = ?").get(deviceIdentity) as { device_scope_uuid: string };
    const localUuid = randomUUID();
    this.db.prepare("INSERT OR IGNORE INTO local_sync_track_map VALUES (?, ?, ?, ?)")
      .run(localSongKey, `${scope.device_scope_uuid}:${localUuid}`, scope.device_scope_uuid, localUuid);
    return this.find(localSongKey)!;
  }
}
