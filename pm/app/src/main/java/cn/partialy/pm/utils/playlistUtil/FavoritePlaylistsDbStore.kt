package cn.partialy.pm.utils.playlistUtil

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.fromCanonicalSource
import cn.partialy.pm.model.toCanonicalPlaylist
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import com.google.gson.Gson

internal class FavoritePlaylistsDbStore(context: Context) {
    private val helper = LocalMusicDbOpenHelper.shared(context.applicationContext)
    private val gson = Gson()
    private val account = cn.partialy.pm.sync.LibraryAccountScope(context)
    private val outbox = cn.partialy.pm.sync.SyncOutboxStore(context)

    fun getPlaylists(scope: String = account.current()): List<CollectedPlaylist> {
        helper.readableDatabase.query(
            TABLE,
            null,
            "account_id = ?",
            arrayOf(scope),
            null,
            null,
            "created_at ASC, name COLLATE NOCASE ASC",
        ).use { cursor ->
            val out = ArrayList<CollectedPlaylist>(cursor.count)
            while (cursor.moveToNext()) out.add(cursor.toCollectedPlaylist())
            return out
        }
    }

    fun addPlaylist(playlist: CollectedPlaylist, recordChange: Boolean = true): Boolean = transaction { db ->
        insertInTransaction(db, playlist, System.currentTimeMillis(), recordChange) != null
    }

    fun addPlaylists(playlists: List<CollectedPlaylist>, recordChange: Boolean = true): List<CollectedPlaylist> {
        if (playlists.isEmpty()) return emptyList()
        return transaction { db ->
            val inserted = ArrayList<CollectedPlaylist>(playlists.size)
            var now = System.currentTimeMillis()
            for (playlist in playlists) {
                insertInTransaction(db, playlist, now, recordChange)?.let { saved ->
                    inserted.add(saved)
                    now++
                }
            }
            inserted
        }
    }

    private fun insertInTransaction(
        db: SQLiteDatabase,
        playlist: CollectedPlaylist,
        now: Long,
        recordChange: Boolean,
    ): CollectedPlaylist? {
        if (playlist.id.isBlank() || playlist.type == CollectedPlaylistType.LOCAL) return null
        val scope = account.current()
        if (existsInTypeFamily(db, scope, playlist.type, playlist.id)) return null
        val saved = playlist.copy(favoritedAt = now)
        val added = db.insertWithOnConflict(
            TABLE,
            null,
            saved.toValues(now, now).apply { put("account_id", scope) },
            SQLiteDatabase.CONFLICT_IGNORE,
        ) != -1L
        if (!added) return null
        if (recordChange) {
            outbox.enqueueInTransaction(
                db,
                scope,
                cn.partialy.pm.sync.SyncPayloads.TYPE_FAVORITE_PLAYLIST,
                cn.partialy.pm.sync.SyncPayloads.playlistKey(saved),
                cn.partialy.pm.sync.SyncPayloads.ACTION_UPSERT,
                cn.partialy.pm.sync.SyncPayloads.playlistPayload(saved),
            )
        }
        return saved
    }

    fun removePlaylist(type: CollectedPlaylistType, id: String, recordChange: Boolean = true): Boolean = transaction { db ->
        if (id.isBlank() || type == CollectedPlaylistType.LOCAL) return@transaction false
        val scope = account.current()
        val family = typeFamily(type)
        val placeholders = family.joinToString(",") { "?" }
        val args = arrayOf(scope, *family.toTypedArray(), id)
        val removed = db.delete(TABLE, "account_id=? AND playlist_type IN ($placeholders) AND playlist_id=?", args) > 0
        if (removed && recordChange) outbox.enqueueInTransaction(db, scope,
            cn.partialy.pm.sync.SyncPayloads.TYPE_FAVORITE_PLAYLIST,
            cn.partialy.pm.sync.SyncPayloads.playlistKey(CollectedPlaylist(type,id,"")), cn.partialy.pm.sync.SyncPayloads.ACTION_DELETE)
        removed
    }

    fun upsertFromSync(playlist: CollectedPlaylist) = transaction { db ->
        val scope = account.current()
        val family = typeFamily(playlist.type)
        val placeholders = family.joinToString(",") { "?" }
        val queryArgs = arrayOf(scope, *family.toTypedArray(), playlist.id)
        val existing = db.rawQuery(
            "SELECT created_at FROM $TABLE WHERE account_id=? AND playlist_type IN ($placeholders) AND playlist_id=? ORDER BY created_at ASC LIMIT 1",
            queryArgs,
        ).use { if (it.moveToFirst()) it.getLong(0) else System.currentTimeMillis() }
        val values = playlist.toValues(playlist.favoritedAt?.takeIf { it > 0 } ?: existing, System.currentTimeMillis())
            .apply { put("account_id", scope) }
        // 若存在历史同源别名行，先更新同源记录；仅当无记录时插入。
        if (db.update(TABLE, values, "account_id=? AND playlist_type=? AND playlist_id=?", arrayOf(scope, playlist.type.name, playlist.id)) == 0) {
            val aliasUpdated = family.filter { it != playlist.type.name }.any { alias ->
                db.update(TABLE, values.apply { put("playlist_type", alias) }, "account_id=? AND playlist_type=? AND playlist_id=?", arrayOf(scope, alias, playlist.id)) > 0
            }
            if (!aliasUpdated) {
                values.put("playlist_type", playlist.type.name)
                db.insertOrThrow(TABLE, null, values)
            }
        }
    }

    private fun existsInTypeFamily(db: SQLiteDatabase, scope: String, type: CollectedPlaylistType, id: String): Boolean {
        val family = typeFamily(type)
        val placeholders = family.joinToString(",") { "?" }
        val args = arrayOf(scope, *family.toTypedArray(), id)
        return db.rawQuery(
            "SELECT 1 FROM $TABLE WHERE account_id=? AND playlist_type IN ($placeholders) AND playlist_id=? LIMIT 1",
            args,
        ).use { it.moveToFirst() }
    }

    private fun typeFamily(type: CollectedPlaylistType): List<String> = when (type) {
        CollectedPlaylistType.KG, CollectedPlaylistType.IMPORT_KG ->
            listOf(CollectedPlaylistType.KG.name, CollectedPlaylistType.IMPORT_KG.name)
        CollectedPlaylistType.WY, CollectedPlaylistType.IMPORT_WY ->
            listOf(CollectedPlaylistType.WY.name, CollectedPlaylistType.IMPORT_WY.name)
        CollectedPlaylistType.LOCAL -> listOf(CollectedPlaylistType.LOCAL.name)
    }

    private fun <T> transaction(action: (SQLiteDatabase) -> T): T {
        val db = helper.writableDatabase
        db.beginTransaction()
        try { val result = action(db); db.setTransactionSuccessful(); return result }
        finally { db.endTransaction() }
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
                    playlist.toValues(createdAt = createdAt++, updatedAt = createdAt).apply { put("account_id", "") },
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
        helper.writableDatabase.delete(TABLE, "account_id = ?", arrayOf(account.current()))
    }

    private fun CollectedPlaylist.toValues(createdAt: Long, updatedAt: Long): ContentValues =
        ContentValues().apply {
            val canonical = toCanonicalPlaylist()
            put("account_id", account.current())
            put("source", canonical.source)
            put("playlist_type", type.name)
            put("playlist_id", id)
            put("name", name)
            put("desc", canonical.desc)
            put("intro", intro)
            put("cover", cover)
            put("song_count", count)
            put("payload_json", gson.toJson(canonical))
            put("created_at", createdAt)
            put("updated_at", updatedAt)
        }

    private fun Cursor.toCollectedPlaylist(): CollectedPlaylist {
        val source = getOptionalString("source")
        val type = if (source.isNotBlank()) {
            CollectedPlaylistType.fromCanonicalSource(source)
        } else {
            runCatching {
                CollectedPlaylistType.valueOf(getString(getColumnIndexOrThrow("playlist_type")))
            }.getOrDefault(CollectedPlaylistType.KG)
        }
        return CollectedPlaylist(
            type = type,
            id = getString(getColumnIndexOrThrow("playlist_id")).orEmpty(),
            name = getString(getColumnIndexOrThrow("name")).orEmpty(),
            intro = getOptionalString("desc").ifBlank {
                getString(getColumnIndexOrThrow("intro")).orEmpty()
            },
            cover = getString(getColumnIndexOrThrow("cover")).orEmpty(),
            count = getInt(getColumnIndexOrThrow("song_count")),
            favoritedAt = getLong(getColumnIndexOrThrow("created_at")),
        )
    }

    private fun Cursor.getOptionalString(column: String): String {
        val index = getColumnIndex(column)
        return if (index >= 0 && !isNull(index)) getString(index).orEmpty() else ""
    }

    private companion object {
        private const val TABLE = "favorite_playlists"
    }
}
