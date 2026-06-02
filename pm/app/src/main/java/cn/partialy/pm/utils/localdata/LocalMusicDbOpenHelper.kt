package cn.partialy.pm.utils.localdata

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

internal class LocalMusicDbOpenHelper(context: Context) :
    SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        createLocalPlaylistTables(db)
        createFavoriteTables(db)
        createSyncTables(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            createFavoriteTables(db)
        }
        if (oldVersion < 3) {
            ensureCanonicalColumns(db)
        }
        if (oldVersion < 4) {
            createSyncTables(db)
        }
        if (oldVersion < 5) {
            ensureSyncOutboxAccountColumn(db)
        }
    }

    private fun createLocalPlaylistTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS local_playlists (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL DEFAULT 'local',
                name TEXT NOT NULL,
                desc TEXT NOT NULL DEFAULT '',
                intro TEXT NOT NULL DEFAULT '',
                cover TEXT NOT NULL DEFAULT '',
                payload_json TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS local_playlist_songs (
                playlist_id TEXT NOT NULL,
                song_id TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT '',
                url_param TEXT NOT NULL DEFAULT '',
                song_type TEXT NOT NULL,
                name TEXT NOT NULL,
                singer TEXT NOT NULL DEFAULT '',
                artist TEXT NOT NULL,
                cover TEXT NOT NULL DEFAULT '',
                cover_url TEXT NOT NULL DEFAULT '',
                album TEXT,
                lyric TEXT,
                duration INTEGER,
                payload_json TEXT NOT NULL DEFAULT '{}',
                sort_order INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (playlist_id, song_id),
                FOREIGN KEY (playlist_id) REFERENCES local_playlists(id) ON DELETE CASCADE
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_local_playlist_songs_order ON local_playlist_songs(playlist_id, sort_order)")
    }

    private fun createFavoriteTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS favorite_songs (
                source TEXT NOT NULL DEFAULT '',
                url_param TEXT NOT NULL DEFAULT '',
                song_type TEXT NOT NULL,
                song_id TEXT NOT NULL,
                name TEXT NOT NULL,
                singer TEXT NOT NULL DEFAULT '',
                artist TEXT NOT NULL,
                cover TEXT NOT NULL DEFAULT '',
                cover_url TEXT NOT NULL DEFAULT '',
                album TEXT,
                lyric TEXT,
                duration INTEGER,
                payload_json TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (song_type, song_id)
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_favorite_songs_created ON favorite_songs(created_at)")

        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS favorite_playlists (
                source TEXT NOT NULL DEFAULT '',
                playlist_type TEXT NOT NULL,
                playlist_id TEXT NOT NULL,
                name TEXT NOT NULL,
                desc TEXT NOT NULL DEFAULT '',
                intro TEXT NOT NULL DEFAULT '',
                cover TEXT NOT NULL DEFAULT '',
                song_count INTEGER NOT NULL DEFAULT 0,
                payload_json TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (playlist_type, playlist_id)
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_favorite_playlists_created ON favorite_playlists(created_at)")
    }

    private fun createSyncTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS sync_outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                op_id TEXT NOT NULL UNIQUE,
                item_type TEXT NOT NULL,
                item_key TEXT NOT NULL,
                action TEXT NOT NULL,
                account_id TEXT NOT NULL DEFAULT '',
                payload_json TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_outbox_created ON sync_outbox(created_at, id)")
        addColumnIfMissing(db, "sync_outbox", "account_id", "TEXT NOT NULL DEFAULT ''")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_outbox_account_created ON sync_outbox(account_id, created_at, id)")
    }

    companion object {
        const val DB_NAME = "pm_local_music.db"
        private const val DB_VERSION = 5
    }

    private fun ensureSyncOutboxAccountColumn(db: SQLiteDatabase) {
        createSyncTables(db)
    }

    private fun ensureCanonicalColumns(db: SQLiteDatabase) {
        addColumnIfMissing(db, "local_playlists", "source", "TEXT NOT NULL DEFAULT 'local'")
        addColumnIfMissing(db, "local_playlists", "desc", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "local_playlists", "payload_json", "TEXT NOT NULL DEFAULT '{}'")
        addColumnIfMissing(db, "local_playlist_songs", "source", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "local_playlist_songs", "url_param", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "local_playlist_songs", "singer", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "local_playlist_songs", "cover", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "local_playlist_songs", "payload_json", "TEXT NOT NULL DEFAULT '{}'")
        addColumnIfMissing(db, "favorite_songs", "source", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "favorite_songs", "url_param", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "favorite_songs", "singer", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "favorite_songs", "cover", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "favorite_songs", "payload_json", "TEXT NOT NULL DEFAULT '{}'")
        addColumnIfMissing(db, "favorite_playlists", "source", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "favorite_playlists", "desc", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, "favorite_playlists", "payload_json", "TEXT NOT NULL DEFAULT '{}'")
        db.execSQL("UPDATE favorite_songs SET source = lower(song_type) WHERE source = ''")
        db.execSQL("UPDATE favorite_songs SET url_param = song_id WHERE url_param = ''")
        db.execSQL("UPDATE favorite_songs SET singer = artist WHERE singer = ''")
        db.execSQL("UPDATE favorite_songs SET cover = cover_url WHERE cover = ''")
        db.execSQL("UPDATE local_playlist_songs SET source = lower(song_type) WHERE source = ''")
        db.execSQL("UPDATE local_playlist_songs SET url_param = song_id WHERE url_param = ''")
        db.execSQL("UPDATE local_playlist_songs SET singer = artist WHERE singer = ''")
        db.execSQL("UPDATE local_playlist_songs SET cover = cover_url WHERE cover = ''")
        db.execSQL("UPDATE favorite_playlists SET source = CASE playlist_type WHEN 'WY' THEN 'wy' WHEN 'IMPORT_WY' THEN 'wy' WHEN 'LOCAL' THEN 'local' ELSE 'kg' END WHERE source = ''")
        db.execSQL("UPDATE favorite_playlists SET desc = intro WHERE desc = ''")
        db.execSQL("UPDATE local_playlists SET desc = intro WHERE desc = ''")
    }

    private fun addColumnIfMissing(db: SQLiteDatabase, table: String, column: String, declaration: String) {
        db.rawQuery("PRAGMA table_info($table)", emptyArray()).use { cursor ->
            while (cursor.moveToNext()) {
                if (cursor.getString(cursor.getColumnIndexOrThrow("name")) == column) return
            }
        }
        db.execSQL("ALTER TABLE $table ADD COLUMN $column $declaration")
    }
}
