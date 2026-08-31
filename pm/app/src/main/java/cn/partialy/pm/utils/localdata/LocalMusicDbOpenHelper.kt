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
        createThirdPartyLoginTables(db)
        createCachedPlaybackTables(db)
        createPlaybackFaultTables(db)
        createLocalSongTables(db)
        createListeningTables(db)
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
        if (oldVersion < 6) {
            createThirdPartyLoginTables(db)
        }
        if (oldVersion < 7) {
            createCachedPlaybackTables(db)
        }
        if (oldVersion < 8) {
            createPlaybackFaultTables(db)
        }
        if (oldVersion < 9) {
            createLocalSongTables(db)
        }
        if (oldVersion < 10) {
            ensureCachedPlaybackCatalogColumns(db)
        }
        if (oldVersion < 11) {
            createListeningTables(db)
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

    private fun createThirdPartyLoginTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS third_party_login_sessions (
                source TEXT PRIMARY KEY,
                cookie TEXT NOT NULL DEFAULT '',
                user_id TEXT NOT NULL DEFAULT '',
                username TEXT NOT NULL DEFAULT '',
                nickname TEXT NOT NULL DEFAULT '',
                avatar_url TEXT NOT NULL DEFAULT '',
                background_url TEXT NOT NULL DEFAULT '',
                is_vip INTEGER NOT NULL DEFAULT 0,
                vip_type TEXT NOT NULL DEFAULT '',
                raw_profile_json TEXT NOT NULL DEFAULT '{}',
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
    }

    private fun createCachedPlaybackTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS cached_playback_records (
                song_key TEXT NOT NULL,
                source TEXT NOT NULL,
                source_id TEXT NOT NULL,
                quality_key TEXT NOT NULL,
                name TEXT NOT NULL,
                artist TEXT NOT NULL DEFAULT '',
                album TEXT NOT NULL DEFAULT '',
                cover_url TEXT NOT NULL DEFAULT '',
                duration INTEGER,
                play_url TEXT NOT NULL DEFAULT '',
                cache_key TEXT NOT NULL DEFAULT '',
                cached_bytes INTEGER NOT NULL DEFAULT 0,
                total_bytes INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'partial',
                last_accessed_at INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL,
                payload_json TEXT NOT NULL DEFAULT '{}',
                PRIMARY KEY (song_key, quality_key)
            )
            """.trimIndent()
        )
        addColumnIfMissing(db, "cached_playback_records", "total_bytes", "INTEGER NOT NULL DEFAULT 0")
        addColumnIfMissing(db, "cached_playback_records", "status", "TEXT NOT NULL DEFAULT 'partial'")
        addColumnIfMissing(db, "cached_playback_records", "last_accessed_at", "INTEGER NOT NULL DEFAULT 0")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_cached_playback_updated ON cached_playback_records(updated_at)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_cached_playback_status_access ON cached_playback_records(status, last_accessed_at DESC)")
    }

    private fun createPlaybackFaultTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS playback_fault_logs (
                id TEXT PRIMARY KEY,
                scene TEXT NOT NULL,
                failure_type TEXT NOT NULL,
                occurred_at INTEGER NOT NULL,
                method_name TEXT NOT NULL DEFAULT '',
                request_method TEXT NOT NULL DEFAULT '',
                request_url TEXT NOT NULL DEFAULT '',
                request_params_json TEXT NOT NULL DEFAULT '{}',
                nonce_id TEXT NOT NULL DEFAULT '',
                response_code INTEGER,
                response_body TEXT NOT NULL DEFAULT '',
                resolved_url TEXT NOT NULL DEFAULT '',
                error_type TEXT NOT NULL DEFAULT '',
                error_message TEXT NOT NULL DEFAULT '',
                stack_trace TEXT NOT NULL DEFAULT '',
                song_source TEXT NOT NULL DEFAULT '',
                song_id TEXT NOT NULL DEFAULT '',
                quality TEXT NOT NULL DEFAULT '',
                is_upload INTEGER NOT NULL DEFAULT 0,
                uploaded_at INTEGER
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_playback_fault_upload_time ON playback_fault_logs(is_upload, occurred_at)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_playback_fault_occurred ON playback_fault_logs(occurred_at DESC)")
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS playback_fault_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_reported_at INTEGER
            )
            """.trimIndent()
        )
        db.execSQL("INSERT OR IGNORE INTO playback_fault_state(id, last_reported_at) VALUES (1, NULL)")
    }

    private fun createLocalSongTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS local_songs (
                id TEXT PRIMARY KEY,
                origin TEXT NOT NULL,
                media_store_id INTEGER,
                content_uri TEXT NOT NULL DEFAULT '',
                file_path TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                artist TEXT NOT NULL DEFAULT '',
                duration INTEGER,
                size INTEGER,
                mime_type TEXT NOT NULL DEFAULT '',
                display_name TEXT NOT NULL DEFAULT '',
                is_deleted INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_local_songs_origin_deleted ON local_songs(origin, is_deleted)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_local_songs_content_uri ON local_songs(content_uri)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_local_songs_media_store_id ON local_songs(media_store_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_local_songs_fallback ON local_songs(display_name, size, duration)")
    }

    private fun createListeningTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS listening_active_checkpoint (
                account_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                play_session_id TEXT NOT NULL,
                source TEXT NOT NULL,
                song_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                artist TEXT NOT NULL DEFAULT '',
                album TEXT,
                track_duration_ms INTEGER,
                started_at_ms INTEGER NOT NULL,
                last_checkpoint_at_ms INTEGER NOT NULL,
                last_monotonic_ms INTEGER NOT NULL,
                active_elapsed_ms INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (account_id, device_id, play_session_id)
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS listening_pending_fragments (
                event_id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                play_session_id TEXT NOT NULL,
                source TEXT NOT NULL,
                song_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                artist TEXT NOT NULL DEFAULT '',
                album TEXT,
                track_duration_ms INTEGER,
                started_at_ms INTEGER NOT NULL,
                ended_at_ms INTEGER NOT NULL,
                active_duration_ms INTEGER NOT NULL,
                terminal_reason TEXT,
                created_at_ms INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_listening_pending_account_created ON listening_pending_fragments(account_id, created_at_ms)")
    }

    companion object {
        const val DB_NAME = "pm_local_music.db"
        private const val DB_VERSION = 11
    }

    private fun ensureCachedPlaybackCatalogColumns(db: SQLiteDatabase) {
        createCachedPlaybackTables(db)
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
