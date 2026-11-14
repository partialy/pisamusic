/** 会话和资源共用生命周期行；对象仅登记在 file_records，删除账号不级联丢弃回收账本。 */
export const PLAYLIST_COVER_SQL = `
CREATE TABLE IF NOT EXISTS playlist_cover_resources (
 id TEXT PRIMARY KEY, upload_id TEXT NOT NULL UNIQUE, owner_user_id TEXT,
 playlist_id TEXT NOT NULL, edit_generation TEXT NOT NULL, file_record_id TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL DEFAULT 'pending', public_url TEXT NOT NULL,
 width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, unreferenced_at INTEGER,
 deletion_claimed_at INTEGER, last_error TEXT NOT NULL DEFAULT '',
 FOREIGN KEY(file_record_id) REFERENCES file_records(id)
);
CREATE INDEX IF NOT EXISTS idx_playlist_cover_gc ON playlist_cover_resources(state,unreferenced_at);
CREATE TABLE IF NOT EXISTS playlist_cover_refs (
 user_id TEXT NOT NULL, playlist_id TEXT NOT NULL, resource_id TEXT NOT NULL,
 PRIMARY KEY(user_id,playlist_id), FOREIGN KEY(resource_id) REFERENCES playlist_cover_resources(id)
);
CREATE INDEX IF NOT EXISTS idx_playlist_cover_ref_resource ON playlist_cover_refs(resource_id);
`;
