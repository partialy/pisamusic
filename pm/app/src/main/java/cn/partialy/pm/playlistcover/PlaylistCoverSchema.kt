package cn.partialy.pm.playlistcover

import android.database.sqlite.SQLiteDatabase

/** V16 仅新增私有状态表，不改写 V15 复合账号关系。 */
internal object PlaylistCoverSchema {
    fun create(db: SQLiteDatabase) {
        db.execSQL("""CREATE TABLE IF NOT EXISTS playlist_cover_edits (
            account_id TEXT NOT NULL, playlist_id TEXT NOT NULL, generation TEXT NOT NULL,
            expected_cover TEXT NOT NULL, fallback TEXT NOT NULL DEFAULT '',
            resource_id TEXT NOT NULL DEFAULT '', resource_url TEXT NOT NULL DEFAULT '',
            upload_id TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'NONE',
            attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT '',
            document_clock INTEGER NOT NULL, PRIMARY KEY(account_id,playlist_id),
            FOREIGN KEY(account_id,playlist_id) REFERENCES local_playlists(owner_account_id,id) ON DELETE CASCADE
        )""")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_cover_queue ON playlist_cover_edits(account_id,state)")
    }
}
