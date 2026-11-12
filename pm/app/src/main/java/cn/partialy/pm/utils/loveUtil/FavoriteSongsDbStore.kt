package cn.partialy.pm.utils.loveUtil

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.fromCanonicalSource
import cn.partialy.pm.model.payloadPlayableOrDefault
import cn.partialy.pm.model.toCanonicalSong
import cn.partialy.pm.sync.SyncOutboxStore
import cn.partialy.pm.sync.SyncPayloads
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import com.google.gson.Gson

internal class FavoriteSongsDbStore(context: Context) {
    private val helper = LocalMusicDbOpenHelper(context.applicationContext)
    private val gson = Gson()
    private val outbox = SyncOutboxStore(context)

    fun getSongs(): List<SongInfo> {
        helper.readableDatabase.query(
            TABLE,
            null,
            null,
            null,
            null,
            null,
            "created_at DESC, rowid DESC",
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

    /** 收藏和同账号待同步操作在同一事务内提交。null 表示迁移或远端下行。 */
    fun addSong(song: SongInfo, accountId: String? = null, createdAt: Long = System.currentTimeMillis()): Boolean = transaction { db ->
        val added = insertSong(db, song, createdAt)
        if (added && accountId != null) enqueue(db, accountId, song, SyncPayloads.ACTION_UPSERT, createdAt)
        added
    }

    fun removeSong(song: SongInfo, accountId: String? = null): Boolean = transaction { db ->
        val removed = song.id.isNotBlank() && db.delete(
            TABLE,
            "song_type = ? AND song_id = ?",
            arrayOf(song.type.name, song.id),
        ) > 0
        if (removed && accountId != null) enqueue(db, accountId, song, SyncPayloads.ACTION_DELETE)
        removed
    }

    fun mergeLegacySongs(songs: List<SongInfo>, accountId: String? = null): Int = transaction { db ->
        var added = 0
        var createdAt = System.currentTimeMillis() + songs.size
        for (song in songs) {
            if (!insertSong(db, song, createdAt--)) continue
            added++
            if (accountId != null) enqueue(db, accountId, song, SyncPayloads.ACTION_UPSERT, createdAt + 1)
        }
        added
    }

    /** 已有数据库或删除事件时，旧 JSON 仅是镜像，不能再次作为迁移来源。 */
    fun hasAuthoritativeData(): Boolean {
        val db = helper.readableDatabase
        db.rawQuery("SELECT 1 FROM $TABLE LIMIT 1", null).use {
            if (it.moveToFirst()) return true
        }
        db.rawQuery(
            "SELECT 1 FROM sync_outbox WHERE item_type = ? LIMIT 1",
            arrayOf(SyncPayloads.TYPE_FAVORITE_SONG),
        ).use { return it.moveToFirst() }
    }

    private fun insertSong(db: SQLiteDatabase, song: SongInfo, createdAt: Long = System.currentTimeMillis()): Boolean {
        if (song.id.isBlank()) return false
        return db.insertWithOnConflict(
            TABLE, null, song.toValues(createdAt, createdAt), SQLiteDatabase.CONFLICT_IGNORE,
        ) != -1L
    }

    private fun enqueue(db: SQLiteDatabase, accountId: String, song: SongInfo, action: String, favoritedAt: Long? = null) {
        if (song.type == SongType.LOCAL) return
        outbox.enqueueInTransaction(
            db, accountId, SyncPayloads.TYPE_FAVORITE_SONG, SyncPayloads.songKey(song), action,
            if (action == SyncPayloads.ACTION_DELETE) "{}" else SyncPayloads.songPayload(song, favoritedAt),
        )
    }

    private fun <T> transaction(action: (SQLiteDatabase) -> T): T {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            val result = action(db)
            db.setTransactionSuccessful()
            return result
        } finally {
            db.endTransaction()
        }
    }

    fun favoriteTimes(): Map<String, Long> = helper.readableDatabase.query(
        TABLE, arrayOf("song_type", "song_id", "created_at"), null, null, null, null, null,
    ).use { cursor ->
        buildMap { while (cursor.moveToNext()) put("${cursor.getString(0)}:${cursor.getString(1)}", cursor.getLong(2)) }
    }

    /** Android 旧 SQLite 也兼容：事务内 update，缺失才 insert。 */
    fun upsertSongFromSync(song: SongInfo, favoritedAt: Long?) = transaction { db ->
        val existing = db.query(TABLE, arrayOf("created_at"), "song_type = ? AND song_id = ?",
            arrayOf(song.type.name, song.id), null, null, null).use { if (it.moveToFirst()) it.getLong(0) else null }
        val createdAt = favoritedAt?.takeIf { it > 0 } ?: existing ?: System.currentTimeMillis()
        val values = song.toValues(createdAt, System.currentTimeMillis())
        if (db.update(TABLE, values, "song_type = ? AND song_id = ?", arrayOf(song.type.name, song.id)) == 0) {
            db.insertOrThrow(TABLE, null, values)
        }
        createdAt
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
            playable = payloadPlayableOrDefault(getOptionalString("payload_json")),
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
