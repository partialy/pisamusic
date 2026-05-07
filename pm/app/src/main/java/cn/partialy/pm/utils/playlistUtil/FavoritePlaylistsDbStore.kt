package cn.partialy.pm.utils.playlistUtil

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper

internal class FavoritePlaylistsDbStore(context: Context) {
    private val helper = LocalMusicDbOpenHelper(context.applicationContext)

    fun getPlaylists(): List<CollectedPlaylist> {
        helper.readableDatabase.query(
            TABLE,
            null,
            null,
            null,
            null,
            null,
            "created_at ASC, name COLLATE NOCASE ASC",
        ).use { cursor ->
            val out = ArrayList<CollectedPlaylist>(cursor.count)
            while (cursor.moveToNext()) out.add(cursor.toCollectedPlaylist())
            return out
        }
    }

    fun addPlaylist(playlist: CollectedPlaylist): Boolean {
        if (playlist.id.isBlank() || playlist.type == CollectedPlaylistType.LOCAL) return false
        val now = System.currentTimeMillis()
        val result = helper.writableDatabase.insertWithOnConflict(
            TABLE,
            null,
            playlist.toValues(createdAt = now, updatedAt = now),
            SQLiteDatabase.CONFLICT_IGNORE,
        )
        return result != -1L
    }

    fun removePlaylist(type: CollectedPlaylistType, id: String): Boolean {
        if (id.isBlank() || type == CollectedPlaylistType.LOCAL) return false
        return helper.writableDatabase.delete(
            TABLE,
            "playlist_type = ? AND playlist_id = ?",
            arrayOf(type.name, id),
        ) > 0
    }

    fun mergeLegacyPlaylists(playlists: List<CollectedPlaylist>): Int {
        val favorites = playlists.filter { it.id.isNotBlank() && it.type != CollectedPlaylistType.LOCAL }
        if (favorites.isEmpty()) return 0
        val db = helper.writableDatabase
        var added = 0
        db.beginTransaction()
        try {
            var createdAt = System.currentTimeMillis()
            for (playlist in favorites) {
                val result = db.insertWithOnConflict(
                    TABLE,
                    null,
                    playlist.toValues(createdAt = createdAt++, updatedAt = createdAt),
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

    private fun CollectedPlaylist.toValues(createdAt: Long, updatedAt: Long): ContentValues =
        ContentValues().apply {
            put("playlist_type", type.name)
            put("playlist_id", id)
            put("name", name)
            put("intro", intro)
            put("cover", cover)
            put("song_count", count)
            put("created_at", createdAt)
            put("updated_at", updatedAt)
        }

    private fun Cursor.toCollectedPlaylist(): CollectedPlaylist {
        val type = runCatching {
            CollectedPlaylistType.valueOf(getString(getColumnIndexOrThrow("playlist_type")))
        }.getOrDefault(CollectedPlaylistType.KG)
        return CollectedPlaylist(
            type = type,
            id = getString(getColumnIndexOrThrow("playlist_id")).orEmpty(),
            name = getString(getColumnIndexOrThrow("name")).orEmpty(),
            intro = getString(getColumnIndexOrThrow("intro")).orEmpty(),
            cover = getString(getColumnIndexOrThrow("cover")).orEmpty(),
            count = getInt(getColumnIndexOrThrow("song_count")),
        )
    }

    private companion object {
        private const val TABLE = "favorite_playlists"
    }
}
