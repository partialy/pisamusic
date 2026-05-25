package cn.partialy.pm.utils.playlistUtil

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.fromCanonicalSource
import cn.partialy.pm.model.toCanonicalPlaylist
import cn.partialy.pm.model.toCanonicalSong
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import com.google.gson.Gson

internal class LocalPlaylistDbStore(context: Context) {
    private val helper = LocalMusicDbOpenHelper(context.applicationContext)
    private val gson = Gson()

    fun getPlaylists(): List<CollectedPlaylist> {
        val db = helper.readableDatabase
        val sql = """
            SELECT p.id, p.name, p.desc, p.intro, p.cover, COUNT(s.song_id) AS song_count
            FROM local_playlists p
            LEFT JOIN local_playlist_songs s ON s.playlist_id = p.id
            GROUP BY p.id
            ORDER BY p.created_at ASC, p.name COLLATE NOCASE ASC
        """.trimIndent()
        db.rawQuery(sql, emptyArray()).use { cursor ->
            val out = ArrayList<CollectedPlaylist>(cursor.count)
            while (cursor.moveToNext()) {
                out.add(
                    CollectedPlaylist(
                        type = CollectedPlaylistType.LOCAL,
                        id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                        name = cursor.getString(cursor.getColumnIndexOrThrow("name")).orEmpty(),
                        intro = cursor.getOptionalString("desc").ifBlank {
                            cursor.getString(cursor.getColumnIndexOrThrow("intro")).orEmpty()
                        },
                        cover = cursor.getString(cursor.getColumnIndexOrThrow("cover")).orEmpty(),
                        count = cursor.getInt(cursor.getColumnIndexOrThrow("song_count")),
                    )
                )
            }
            return out
        }
    }

    fun playlistExists(id: String): Boolean {
        if (id.isBlank()) return false
        helper.readableDatabase.query(
            "local_playlists",
            arrayOf("id"),
            "id = ?",
            arrayOf(id),
            null,
            null,
            null,
            "1",
        ).use { return it.moveToFirst() }
    }

    fun upsertPlaylist(playlist: CollectedPlaylist) {
        if (playlist.id.isBlank() || playlist.type != CollectedPlaylistType.LOCAL) return
        val now = System.currentTimeMillis()
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            val existingCreatedAt = queryCreatedAt(db, playlist.id)
            val values = ContentValues().apply {
                val canonical = playlist.toCanonicalPlaylist()
                put("id", playlist.id)
                put("source", canonical.source)
                put("name", playlist.name)
                put("desc", canonical.desc)
                put("intro", playlist.intro)
                put("cover", playlist.cover)
                put("payload_json", gson.toJson(canonical))
                put("created_at", existingCreatedAt ?: now)
                put("updated_at", now)
            }
            db.insertWithOnConflict(
                "local_playlists",
                null,
                values,
                SQLiteDatabase.CONFLICT_REPLACE,
            )
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun removePlaylist(id: String) {
        if (id.isBlank()) return
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            db.delete("local_playlist_songs", "playlist_id = ?", arrayOf(id))
            db.delete("local_playlists", "id = ?", arrayOf(id))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun getSongs(playlistId: String): List<SongInfo> {
        if (playlistId.isBlank()) return emptyList()
        helper.readableDatabase.query(
            "local_playlist_songs",
            null,
            "playlist_id = ?",
            arrayOf(playlistId),
            null,
            null,
            "sort_order ASC",
        ).use { cursor ->
            val out = ArrayList<SongInfo>(cursor.count)
            while (cursor.moveToNext()) out.add(cursor.toSongInfo())
            return out
        }
    }

    fun setSongs(playlistId: String, songs: List<SongInfo>) {
        if (playlistId.isBlank()) return
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            db.delete("local_playlist_songs", "playlist_id = ?", arrayOf(playlistId))
            songs.forEachIndexed { index, song ->
                if (song.id.isBlank()) return@forEachIndexed
                db.insertWithOnConflict(
                    "local_playlist_songs",
                    null,
                    song.toValues(playlistId, index),
                    SQLiteDatabase.CONFLICT_REPLACE,
                )
            }
            touchPlaylist(db, playlistId)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun mergeLegacyPlaylist(playlist: CollectedPlaylist, songs: List<SongInfo>) {
        if (playlist.type != CollectedPlaylistType.LOCAL || playlist.id.isBlank()) return
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            if (queryCreatedAt(db, playlist.id) == null) {
                val now = System.currentTimeMillis()
                val values = ContentValues().apply {
                    val canonical = playlist.toCanonicalPlaylist()
                    put("id", playlist.id)
                    put("source", canonical.source)
                    put("name", playlist.name)
                    put("desc", canonical.desc)
                    put("intro", playlist.intro)
                    put("cover", playlist.cover)
                    put("payload_json", gson.toJson(canonical))
                    put("created_at", now)
                    put("updated_at", now)
                }
                db.insert("local_playlists", null, values)
            }
            val existingIds = getSongIds(db, playlist.id)
            var nextOrder = queryNextSortOrder(db, playlist.id)
            for (song in songs) {
                if (song.id.isBlank() || song.id in existingIds) continue
                db.insert(
                    "local_playlist_songs",
                    null,
                    song.toValues(playlist.id, nextOrder++),
                )
                existingIds.add(song.id)
            }
            touchPlaylist(db, playlist.id)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun clearAll() {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            db.delete("local_playlist_songs", null, null)
            db.delete("local_playlists", null, null)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun queryCreatedAt(db: SQLiteDatabase, id: String): Long? {
        db.query(
            "local_playlists",
            arrayOf("created_at"),
            "id = ?",
            arrayOf(id),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getLong(0) else null
        }
    }

    private fun touchPlaylist(db: SQLiteDatabase, id: String) {
        val values = ContentValues().apply {
            put("updated_at", System.currentTimeMillis())
        }
        db.update("local_playlists", values, "id = ?", arrayOf(id))
    }

    private fun getSongIds(db: SQLiteDatabase, playlistId: String): MutableSet<String> {
        db.query(
            "local_playlist_songs",
            arrayOf("song_id"),
            "playlist_id = ?",
            arrayOf(playlistId),
            null,
            null,
            null,
        ).use { cursor ->
            val ids = HashSet<String>(cursor.count)
            while (cursor.moveToNext()) ids.add(cursor.getString(0))
            return ids
        }
    }

    private fun queryNextSortOrder(db: SQLiteDatabase, playlistId: String): Int {
        db.rawQuery(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM local_playlist_songs WHERE playlist_id = ?",
            arrayOf(playlistId),
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    private fun SongInfo.toValues(playlistId: String, sortOrder: Int): ContentValues =
        ContentValues().apply {
            val canonical = toCanonicalSong()
            put("playlist_id", playlistId)
            put("song_id", id)
            put("source", canonical.source)
            put("url_param", canonical.urlParam)
            put("song_type", type.name)
            put("name", name)
            put("singer", canonical.singer)
            put("artist", artist)
            put("cover", canonical.cover)
            put("cover_url", coverUrl)
            put("album", album)
            put("lyric", lyric)
            put("duration", duration)
            put("payload_json", gson.toJson(canonical))
            put("sort_order", sortOrder)
            put("updated_at", System.currentTimeMillis())
        }

    private fun Cursor.toSongInfo(): SongInfo {
        val source = getOptionalString("source")
        val type = if (source.isNotBlank()) {
            SongType.fromCanonicalSource(source)
        } else {
            runCatching {
                SongType.valueOf(getString(getColumnIndexOrThrow("song_type")))
            }.getOrDefault(SongType.LOCAL)
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

}
