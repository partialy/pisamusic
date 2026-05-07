package cn.partialy.pm.utils.localdata

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

internal class LocalMusicDbOpenHelper(context: Context) :
    SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        createLocalPlaylistTables(db)
        createFavoriteTables(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            createFavoriteTables(db)
        }
    }

    private fun createLocalPlaylistTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS local_playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                intro TEXT NOT NULL DEFAULT '',
                cover TEXT NOT NULL DEFAULT '',
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
                song_type TEXT NOT NULL,
                name TEXT NOT NULL,
                artist TEXT NOT NULL,
                cover_url TEXT NOT NULL DEFAULT '',
                album TEXT,
                lyric TEXT,
                duration INTEGER,
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
                song_type TEXT NOT NULL,
                song_id TEXT NOT NULL,
                name TEXT NOT NULL,
                artist TEXT NOT NULL,
                cover_url TEXT NOT NULL DEFAULT '',
                album TEXT,
                lyric TEXT,
                duration INTEGER,
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
                playlist_type TEXT NOT NULL,
                playlist_id TEXT NOT NULL,
                name TEXT NOT NULL,
                intro TEXT NOT NULL DEFAULT '',
                cover TEXT NOT NULL DEFAULT '',
                song_count INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (playlist_type, playlist_id)
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_favorite_playlists_created ON favorite_playlists(created_at)")
    }

    companion object {
        const val DB_NAME = "pm_local_music.db"
        private const val DB_VERSION = 2
    }
}
