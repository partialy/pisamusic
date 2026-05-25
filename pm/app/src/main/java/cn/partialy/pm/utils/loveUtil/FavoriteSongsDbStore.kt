package cn.partialy.pm.utils.loveUtil

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.fromCanonicalSource
import cn.partialy.pm.model.toCanonicalSong
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import com.google.gson.Gson

internal class FavoriteSongsDbStore(context: Context) {
    private val helper = LocalMusicDbOpenHelper(context.applicationContext)
    private val gson = Gson()

    fun getSongs(): List<SongInfo> {
        helper.readableDatabase.query(
            TABLE,
            null,
            null,
            null,
            null,
            null,
            "created_at ASC",
        ).use { cursor ->
            val out = ArrayList<SongInfo>(cursor.count)
            while (cursor.moveToNext()) out.add(cursor.toSongInfo())
            return out
        }
    }

    fun contains(song: SongInfo): Boolean = contains(song.type, song.id)

    fun contains(type: SongType, id: String): Boolean {
        if (id.isBlank()) return false
        helper.readableDatabase.query(
            TABLE,
            arrayOf("song_id"),
            "song_type = ? AND song_id = ?",
            arrayOf(type.name, id),
            null,
            null,
            null,
            "1",
        ).use { return it.moveToFirst() }
    }

    fun addSong(song: SongInfo): Boolean {
        if (song.id.isBlank()) return false
        val now = System.currentTimeMillis()
        val result = helper.writableDatabase.insertWithOnConflict(
            TABLE,
            null,
            song.toValues(createdAt = now, updatedAt = now),
            SQLiteDatabase.CONFLICT_IGNORE,
        )
        return result != -1L
    }

    fun removeSong(song: SongInfo): Boolean {
        if (song.id.isBlank()) return false
        return helper.writableDatabase.delete(
            TABLE,
            "song_type = ? AND song_id = ?",
            arrayOf(song.type.name, song.id),
        ) > 0
    }

    fun mergeLegacySongs(songs: List<SongInfo>): Int {
        if (songs.isEmpty()) return 0
        val db = helper.writableDatabase
        var added = 0
        db.beginTransaction()
        try {
            var createdAt = System.currentTimeMillis()
            for (song in songs) {
                if (song.id.isBlank()) continue
                val result = db.insertWithOnConflict(
                    TABLE,
                    null,
                    song.toValues(createdAt = createdAt++, updatedAt = createdAt),
                    SQLiteDatabase.CONFLICT_IGNORE,
                )
                if (result != -1L) added++
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        return added
    }

    fun clearAll() {
        helper.writableDatabase.delete(TABLE, null, null)
    }

    private fun SongInfo.toValues(createdAt: Long, updatedAt: Long): ContentValues =
        ContentValues().apply {
            val canonical = toCanonicalSong()
            put("source", canonical.source)
            put("url_param", canonical.urlParam)
            put("song_type", type.name)
            put("song_id", id)
            put("name", name)
            put("singer", canonical.singer)
            put("artist", artist)
            put("cover", canonical.cover)
            put("cover_url", coverUrl)
            put("album", album)
            put("lyric", lyric)
            put("duration", duration)
            put("payload_json", gson.toJson(canonical))
            put("created_at", createdAt)
            put("updated_at", updatedAt)
        }

    private fun Cursor.toSongInfo(): SongInfo {
        val source = getOptionalString("source")
        val type = if (source.isNotBlank()) {
            SongType.fromCanonicalSource(source)
        } else {
            runCatching {
                SongType.valueOf(getString(getColumnIndexOrThrow("song_type")))
            }.getOrDefault(SongType.KG)
        }
        val durationIndex = getColumnIndexOrThrow("duration")
        return SongInfo(
            id = getString(getColumnIndexOrThrow("song_id")).orEmpty(),
            type = type,
            name = getString(getColumnIndexOrThrow("name")).orEmpty(),
            artist = getOptionalString("singer").ifBlank {
                getString(getColumnIndexOrThrow("artist")).orEmpty()
            },
            coverUrl = getOptionalString("cover").ifBlank {
                getString(getColumnIndexOrThrow("cover_url")).orEmpty()
            },
            album = getString(getColumnIndexOrThrow("album")),
            lyric = getString(getColumnIndexOrThrow("lyric")),
            duration = if (isNull(durationIndex)) null else getInt(durationIndex),
        )
    }

    private fun Cursor.getOptionalString(column: String): String {
        val index = getColumnIndex(column)
        return if (index >= 0 && !isNull(index)) getString(index).orEmpty() else ""
    }

    private companion object {
        private const val TABLE = "favorite_songs"
    }
}
