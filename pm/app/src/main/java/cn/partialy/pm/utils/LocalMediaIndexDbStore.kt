package cn.partialy.pm.utils

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType

class LocalMediaIndexDbStore(context: Context) {
    private val helper = Helper(context.applicationContext)

    data class CoverIndex(
        val source: String,
        val value: String,
    )

    fun getLyric(song: SongInfo): String? {
        val key = song.mediaKey()
        helper.readableDatabase.query(
            "lyric_index",
            arrayOf("lyric"),
            "song_key = ?",
            arrayOf(key),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            return cursor.getString(0)?.takeIf { it.isNotBlank() }
        }
    }

    fun upsertLyric(song: SongInfo, lyric: String, source: String) {
        val text = lyric.trim()
        if (text.isBlank() || text == "error" || text == "暂无歌词") return
        val now = System.currentTimeMillis()
        val values = ContentValues().apply {
            put("song_key", song.mediaKey())
            put("song_type", song.type.name)
            put("song_id", song.id)
            put("song_name", song.name)
            put("artist", song.artist)
            put("lyric", text)
            put("source", source)
            put("updated_at", now)
        }
        helper.writableDatabase.insertWithOnConflict(
            "lyric_index",
            null,
            values,
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun upsertCover(song: SongInfo, source: String, value: String) {
        val normalized = value.trim()
        if (normalized.isBlank()) return
        val now = System.currentTimeMillis()
        val values = ContentValues().apply {
            put("song_key", song.mediaKey())
            put("song_type", song.type.name)
            put("song_id", song.id)
            put("song_name", song.name)
            put("artist", song.artist)
            put("cover_source", source)
            put("cover_value", normalized)
            put("updated_at", now)
        }
        helper.writableDatabase.insertWithOnConflict(
            "cover_index",
            null,
            values,
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun getCover(song: SongInfo): CoverIndex? {
        helper.readableDatabase.query(
            "cover_index",
            arrayOf("cover_source", "cover_value"),
            "song_key = ?",
            arrayOf(song.mediaKey()),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            val source = cursor.getString(0).orEmpty()
            val value = cursor.getString(1).orEmpty()
            return if (source.isNotBlank() && value.isNotBlank()) CoverIndex(source, value) else null
        }
    }

    fun clearLyrics() {
        helper.writableDatabase.delete("lyric_index", null, null)
    }

    fun lyricBytes(): Long {
        helper.readableDatabase.rawQuery(
            "SELECT COALESCE(SUM(LENGTH(lyric)), 0) FROM lyric_index",
            emptyArray(),
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getLong(0) else 0L
        }
    }

    private fun SongInfo.mediaKey(): String = mediaKey(type, id)

    private class Helper(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE lyric_index (
                    song_key TEXT PRIMARY KEY,
                    song_type TEXT NOT NULL,
                    song_id TEXT NOT NULL,
                    song_name TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    lyric TEXT NOT NULL,
                    source TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE cover_index (
                    song_key TEXT PRIMARY KEY,
                    song_type TEXT NOT NULL,
                    song_id TEXT NOT NULL,
                    song_name TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    cover_source TEXT NOT NULL,
                    cover_value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL("CREATE INDEX idx_lyric_index_type_id ON lyric_index(song_type, song_id)")
            db.execSQL("CREATE INDEX idx_cover_index_type_id ON cover_index(song_type, song_id)")
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            // Future media-index migrations live here.
        }
    }

    companion object {
        private const val DB_NAME = "pm_media_index.db"
        private const val DB_VERSION = 1

        fun mediaKey(type: SongType, id: String): String = "${type.name}:$id"
    }
}
