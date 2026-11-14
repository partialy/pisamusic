package cn.partialy.pm.utils.localdata

import android.database.sqlite.SQLiteDatabase

/** V15：旧关系一律保留在未关联区，不能根据升级时的登录态猜测历史归属。 */
internal object AccountLibrarySchema {
    fun prepare(db: SQLiteDatabase) {
        addColumn(db, "local_playlists", "owner_account_id", "TEXT NOT NULL DEFAULT ''")
        addColumn(db, "local_playlist_songs", "sort_version", "INTEGER NOT NULL DEFAULT 0")
        addColumn(db, "local_playlist_songs", "track_key", "TEXT NOT NULL DEFAULT ''")
        migrateLocalPlaylists(db)
        migrateFavorite(db, "favorite_songs", "song_type, song_id")
        migrateFavorite(db, "favorite_playlists", "playlist_type, playlist_id")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_local_playlist_owner ON local_playlists(owner_account_id)")
        db.execSQL("""CREATE TABLE IF NOT EXISTS local_sync_track_map (
            local_song_key TEXT PRIMARY KEY, sync_track_id TEXT NOT NULL UNIQUE,
            playback_id TEXT NOT NULL, duration_ms INTEGER, created_at INTEGER NOT NULL
        )""")
        db.execSQL("""CREATE TABLE IF NOT EXISTS unassociated_library_imports (
            account_id TEXT NOT NULL, source_playlist_id TEXT NOT NULL, target_playlist_id TEXT NOT NULL,
            PRIMARY KEY(account_id,source_playlist_id)
        )""")
        db.execSQL("""CREATE TABLE IF NOT EXISTS local_playlist_tombstones (
            account_id TEXT NOT NULL, playlist_id TEXT NOT NULL, PRIMARY KEY(account_id,playlist_id)
        )""")
    }

    private fun migrateLocalPlaylists(db: SQLiteDatabase) {
        if ("account_id" in columns(db, "local_playlist_songs")) return
        val playlistColumns = columns(db, "local_playlists").joinToString(",")
        val songColumns = columns(db, "local_playlist_songs").joinToString(",")
        db.execSQL("ALTER TABLE local_playlist_songs RENAME TO local_playlist_songs_v14")
        db.execSQL("ALTER TABLE local_playlists RENAME TO local_playlists_v14")
        db.execSQL("""CREATE TABLE local_playlists (
            owner_account_id TEXT NOT NULL DEFAULT '', id TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'local', name TEXT NOT NULL,
            desc TEXT NOT NULL DEFAULT '', intro TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '',
            payload_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            PRIMARY KEY(owner_account_id,id)
        )""")
        db.execSQL("""CREATE TABLE local_playlist_songs (
            account_id TEXT NOT NULL DEFAULT '', playlist_id TEXT NOT NULL, song_id TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT '', url_param TEXT NOT NULL DEFAULT '', song_type TEXT NOT NULL,
            name TEXT NOT NULL, singer TEXT NOT NULL DEFAULT '', artist TEXT NOT NULL,
            cover TEXT NOT NULL DEFAULT '', cover_url TEXT NOT NULL DEFAULT '', album TEXT, lyric TEXT,
            duration INTEGER, payload_json TEXT NOT NULL DEFAULT '{}', sort_order INTEGER NOT NULL,
            updated_at INTEGER NOT NULL, sort_version INTEGER NOT NULL DEFAULT 0, track_key TEXT NOT NULL DEFAULT '',
            PRIMARY KEY(account_id,playlist_id,song_type,song_id),
            FOREIGN KEY(account_id,playlist_id) REFERENCES local_playlists(owner_account_id,id) ON DELETE CASCADE
        )""")
        db.execSQL("INSERT INTO local_playlists ($playlistColumns) SELECT $playlistColumns FROM local_playlists_v14")
        db.execSQL("INSERT INTO local_playlist_songs ($songColumns) SELECT $songColumns FROM local_playlist_songs_v14")
        for (table in listOf("local_playlists", "local_playlist_songs")) {
            val counts = listOf(table, "${table}_v14").map { name ->
                db.rawQuery("SELECT COUNT(*) FROM $name", null).use { it.moveToFirst(); it.getLong(0) }
            }
            check(counts[0] == counts[1]) { "歌单账号迁移数量不匹配" }
        }
        db.execSQL("DROP TABLE local_playlist_songs_v14")
        db.execSQL("DROP TABLE local_playlists_v14")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_local_playlist_songs_order ON local_playlist_songs(account_id,playlist_id,sort_order,sort_version,track_key)")
    }

    private fun migrateFavorite(db: SQLiteDatabase, table: String, keys: String) {
        if (columns(db, table).contains("account_id")) return
        val oldColumns = columns(db, table)
        val create = db.rawQuery("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", arrayOf(table)).use {
            check(it.moveToFirst()); it.getString(0)
        }
        db.execSQL("ALTER TABLE $table RENAME TO ${table}_v14")
        val revised = create.replaceFirst("(", "(account_id TEXT NOT NULL DEFAULT '',")
            .replace("PRIMARY KEY ($keys)", "PRIMARY KEY (account_id, $keys)")
        check(revised.contains("PRIMARY KEY (account_id, $keys)")) { "收藏迁移主键不匹配" }
        db.execSQL(revised)
        val names = oldColumns.joinToString(",")
        db.execSQL("INSERT INTO $table ($names) SELECT $names FROM ${table}_v14")
        val counts = listOf(table, "${table}_v14").map { name ->
            db.rawQuery("SELECT COUNT(*) FROM $name", null).use { it.moveToFirst(); it.getLong(0) }
        }
        check(counts[0] == counts[1]) { "收藏迁移数量不匹配" }
        db.execSQL("DROP TABLE ${table}_v14")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_${table}_account_created ON $table(account_id,created_at)")
    }

    private fun columns(db: SQLiteDatabase, table: String): List<String> =
        db.rawQuery("PRAGMA table_info($table)", null).use { cursor ->
            buildList { while (cursor.moveToNext()) add(cursor.getString(cursor.getColumnIndexOrThrow("name"))) }
        }

    private fun addColumn(db: SQLiteDatabase, table: String, name: String, declaration: String) {
        if (name !in columns(db, table)) db.execSQL("ALTER TABLE $table ADD COLUMN $name $declaration")
    }
}
