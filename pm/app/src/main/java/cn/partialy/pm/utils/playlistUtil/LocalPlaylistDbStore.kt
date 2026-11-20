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
import cn.partialy.pm.model.payloadPlayableOrDefault
import cn.partialy.pm.model.toCanonicalPlaylist
import cn.partialy.pm.model.toCanonicalSong
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import cn.partialy.pm.sync.SyncOutboxStore
import cn.partialy.pm.sync.SyncPayloads
import com.google.gson.Gson

internal class LocalPlaylistDbStore(context: Context) {
    private val helperContext=context.applicationContext
    private val helper = LocalMusicDbOpenHelper.shared(helperContext)
    private val gson = Gson()
    private val account = cn.partialy.pm.sync.LibraryAccountScope(context)
    private val localTracks = cn.partialy.pm.sync.LocalSyncTrackStore(context)

    fun allCoverReferences(): List<String> = helper.readableDatabase.rawQuery("SELECT cover FROM local_playlists UNION ALL SELECT fallback FROM playlist_cover_edits", null).use { cursor ->
        buildList { while (cursor.moveToNext()) add(cursor.getString(0).orEmpty()) }
    }

    fun getPlaylists(scope: String = account.current()): List<CollectedPlaylist> {
        val db = helper.readableDatabase
        val sql = """
            SELECT p.id, p.name, p.desc, p.intro, p.cover, p.payload_json, COUNT(s.song_id) AS song_count
            FROM local_playlists p
            LEFT JOIN local_playlist_songs s ON s.playlist_id = p.id AND s.account_id = p.owner_account_id
            WHERE p.owner_account_id = ?
            GROUP BY p.id
            ORDER BY p.created_at ASC, p.name COLLATE NOCASE ASC
        """.trimIndent()
        db.rawQuery(sql, arrayOf(scope)).use { cursor ->
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
                        cover = cursor.getString(cursor.getColumnIndexOrThrow("cover")).orEmpty().ifBlank { cursor.playlistPayload()?.coverPreset?.let { "preset:$it" }.orEmpty() },
                        count = cursor.getInt(cursor.getColumnIndexOrThrow("song_count")),
                        coverResource = cursor.playlistPayload()?.coverResource,
                        coverPreset = cursor.playlistPayload()?.coverPreset,
                        coverResourcePresent = cursor.playlistPayload()?.coverResourcePresent ?: false,
                        coverPresetPresent = cursor.playlistPayload()?.coverPresetPresent ?: false,
                    )
                )
            }
            return out
        }
    }

    fun playlistExists(id: String, anyScope: Boolean = false): Boolean {
        if (id.isBlank()) return false
        helper.readableDatabase.query(
            "local_playlists",
            arrayOf("id"),
            if (anyScope) "id = ?" else "id = ? AND owner_account_id = ?",
            if (anyScope) arrayOf(id) else arrayOf(id, account.current()),
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
                put("owner_account_id", account.current())
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
            if (existingCreatedAt == null) {
                db.insertOrThrow("local_playlists", null, values)
            } else check(db.update("local_playlists", values, "id=? AND owner_account_id=?",
                arrayOf(playlist.id, account.current())) == 1)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun upsertFromSync(playlist: CollectedPlaylist, ownEcho: Boolean, clock: Long): CollectedPlaylist = transaction { db ->
        val edits=cn.partialy.pm.playlistcover.PlaylistCoverStore(helperContext)
        val next=edits.remote(account.current(),playlist,ownEcho,clock)
        upsertPlaylist(next)
        clearParentDeleted(next.id)
        if(edits.get(account.current(),next.id)==null)
            cn.partialy.pm.playlistcover.PlaylistCoverStore.recordLocalEdit(db,account.current(),next.id,clock)
        next
    }

    fun createPlaylistWithSongs(playlist: CollectedPlaylist, songs: List<SongInfo>, outbox: SyncOutboxStore) {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            val accountId = outbox.accountSnapshot()
            val now = System.currentTimeMillis()
            val canonical = playlist.toCanonicalPlaylist()
            db.insertOrThrow("local_playlists", null, ContentValues().apply {
                put("owner_account_id", accountId)
                put("id", playlist.id)
                put("source", canonical.source)
                put("name", playlist.name)
                put("desc", canonical.desc)
                put("intro", playlist.intro)
                put("cover", playlist.cover)
                put("payload_json", gson.toJson(canonical))
                put("created_at", now)
                put("updated_at", now)
            })
            outbox.enqueueInTransaction(db, accountId, SyncPayloads.TYPE_USER_PLAYLIST,
                SyncPayloads.playlistKey(playlist), SyncPayloads.ACTION_UPSERT, SyncPayloads.playlistPayload(playlist))
            songs.forEachIndexed { index, song ->
                db.insertOrThrow("local_playlist_songs", null, song.toValues(playlist.id, index.toLong()))
                outbox.enqueueInTransaction(db, accountId,
                    SyncPayloads.TYPE_PLAYLIST_TRACK, SyncPayloads.playlistTrackKey(playlist.id, localTracks.bind(song, db)),
                    SyncPayloads.ACTION_UPSERT, SyncPayloads.songPayload(localTracks.bind(song, db), sortOrder = index.toLong()))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun removePlaylist(id: String) {
        if (id.isBlank() || !playlistExists(id)) return
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            db.delete("local_playlist_songs", "playlist_id = ? AND account_id = ?", arrayOf(id, account.current()))
            db.delete("playlist_cover_edits", "playlist_id=? AND account_id=?", arrayOf(id,account.current()))
            db.delete("local_playlists", "id = ? AND owner_account_id = ?", arrayOf(id, account.current()))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun getPlaylistUpdatedAtMap(scope: String = account.current()): Map<String, Long> =
        helper.readableDatabase.rawQuery(
            "SELECT id, updated_at FROM local_playlists WHERE owner_account_id = ?",
            arrayOf(scope),
        ).use { cursor ->
            buildMap { while (cursor.moveToNext()) put(cursor.getString(0), cursor.getLong(1)) }
        }

    fun getSongUpdatedAtMap(playlistId: String, scope: String = account.current()): Map<String, Long> =
        helper.readableDatabase.rawQuery(
            "SELECT song_type, song_id, updated_at FROM local_playlist_songs WHERE playlist_id = ? AND account_id = ?",
            arrayOf(playlistId, scope),
        ).use { cursor ->
            buildMap { while (cursor.moveToNext()) put("${cursor.getString(0)}:${cursor.getString(1)}", cursor.getLong(2)) }
        }

    fun getSongs(playlistId: String, scope: String = account.current()): List<SongInfo> {
        if (playlistId.isBlank()) return emptyList()
        val owned = helper.readableDatabase.rawQuery("SELECT 1 FROM local_playlists WHERE id=? AND owner_account_id=?", arrayOf(playlistId,scope)).use { it.moveToFirst() }
        if (!owned) return emptyList()
        val stored = helper.readableDatabase.query(
            "local_playlist_songs",
            null,
            "playlist_id = ? AND account_id = ?",
            arrayOf(playlistId, scope),
            null,
            null,
            "sort_order ASC, sort_version ASC, track_key ASC",
        ).use { cursor ->
            val out = ArrayList<SongInfo>(cursor.count)
            while (cursor.moveToNext()) out.add(cursor.toSongInfo())
            out
        }
        return stored.map { localTracks.restore(it) }
    }

    fun setSongs(playlistId: String, songs: List<SongInfo>) {
        if (playlistId.isBlank() || !playlistExists(playlistId)) return
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            val versions = db.rawQuery("SELECT song_type,song_id,sort_version FROM local_playlist_songs WHERE playlist_id=? AND account_id=?", arrayOf(playlistId,account.current())).use { cursor ->
                buildMap { while (cursor.moveToNext()) put(cursor.getString(0) to cursor.getString(1),cursor.getLong(2)) }
            }
            db.delete("local_playlist_songs", "playlist_id = ? AND account_id = ?", arrayOf(playlistId, account.current()))
            songs.distinctBy { it.type to it.id }.forEachIndexed { index, song ->
                if (song.id.isBlank()) return@forEachIndexed
                db.insertOrThrow("local_playlist_songs", null, song.toValues(playlistId, index.toLong()).apply { put("sort_version",versions[song.type.name to song.id] ?: 0L) })
            }
            touchPlaylist(db, playlistId)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun addSongsWithOutbox(playlist: CollectedPlaylist, added: List<SongInfo>, outbox: SyncOutboxStore) {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            val accountId = outbox.accountSnapshot()
            check(playlistExists(playlist.id)) { "歌单不属于当前账号" }
            var nextOrder = queryNextSortOrder(db, playlist.id)
            val actualOrders = linkedMapOf<Pair<SongType,String>,Long>()
            added.forEach { song ->
                val order = nextOrder++
                db.insertOrThrow("local_playlist_songs",null,song.toValues(playlist.id,order))
                actualOrders[song.type to song.id] = order.toLong()
            }
            val updated = db.update("local_playlists", ContentValues().apply {
                put("cover", playlist.cover)
                put("payload_json", gson.toJson(playlist.toCanonicalPlaylist()))
                put("updated_at", System.currentTimeMillis())
            }, "id = ? AND owner_account_id = ?", arrayOf(playlist.id, account.current()))
            check(updated == 1) { "更新本地歌单封面失败" }
            outbox.enqueueInTransaction(db, accountId, SyncPayloads.TYPE_USER_PLAYLIST,
                SyncPayloads.playlistKey(playlist), SyncPayloads.ACTION_UPSERT, SyncPayloads.playlistPayload(playlist))
            added.forEach { song ->
                outbox.enqueueInTransaction(db, accountId, SyncPayloads.TYPE_PLAYLIST_TRACK,
                    SyncPayloads.playlistTrackKey(playlist.id, localTracks.bind(song, db)), SyncPayloads.ACTION_UPSERT, SyncPayloads.songPayload(localTracks.bind(song, db), sortOrder = actualOrders[song.type to song.id]))
            }
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
            if (!db.rawQuery("SELECT 1 FROM local_playlists WHERE id=? AND owner_account_id=''", arrayOf(playlist.id)).use { it.moveToFirst() }) {
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
            var nextOrder = db.rawQuery("SELECT COALESCE(MAX(sort_order),-1)+1 FROM local_playlist_songs WHERE playlist_id=? AND account_id=''", arrayOf(playlist.id)).use { it.moveToFirst(); it.getLong(0) }
            for (song in songs) {
                if (song.id.isBlank() || (song.type.name to song.id) in existingIds) continue
                db.insert(
                    "local_playlist_songs",
                    null,
                    song.toValues(playlist.id, nextOrder++).apply { put("account_id", "") },
                )
                existingIds.add(song.type.name to song.id)
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
            db.delete("local_playlist_songs", "account_id=?", arrayOf(account.current()))
            db.delete("playlist_cover_edits", "account_id=?", arrayOf(account.current()))
            db.delete("local_playlists", "owner_account_id=?", arrayOf(account.current()))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun queryCreatedAt(db: SQLiteDatabase, id: String): Long? {
        db.query(
            "local_playlists",
            arrayOf("created_at"),
            "id = ? AND owner_account_id = ?",
            arrayOf(id, account.current()),
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
        db.update("local_playlists", values, "id = ? AND owner_account_id = ?", arrayOf(id, account.current()))
    }

    private fun getSongIds(db: SQLiteDatabase, playlistId: String): MutableSet<Pair<String, String>> {
        db.query(
            "local_playlist_songs",
            arrayOf("song_type", "song_id"),
            "playlist_id = ? AND account_id = ?",
            arrayOf(playlistId, ""),
            null,
            null,
            null,
        ).use { cursor ->
            val ids = HashSet<Pair<String, String>>(cursor.count)
            while (cursor.moveToNext()) ids.add(cursor.getString(0) to cursor.getString(1))
            return ids
        }
    }

    private fun queryNextSortOrder(db: SQLiteDatabase, playlistId: String): Long {
        db.rawQuery(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM local_playlist_songs WHERE playlist_id = ? AND account_id = ?",
            arrayOf(playlistId, account.current()),
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getLong(0) else 0L
        }
    }

    private fun SongInfo.toValues(playlistId: String, sortOrder: Long): ContentValues =
        ContentValues().apply {
            val canonical = localTracks.bind(this@toValues, helper.writableDatabase).toCanonicalSong()
            put("account_id", account.current())
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
            put("track_key", SyncPayloads.songKey(localTracks.bind(this@toValues, helper.writableDatabase)))
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
        val metadata = runCatching { gson.fromJson(getOptionalString("payload_json"), cn.partialy.pm.model.CanonicalSong::class.java) }.getOrNull()
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
            localSyncId = metadata?.localSyncId, durationMs = metadata?.durationMs,
        )
    }

    private fun Cursor.getOptionalString(column: String): String {
        val index = getColumnIndex(column)
        return if (index >= 0 && !isNull(index)) getString(index).orEmpty() else ""
    }

    private fun Cursor.playlistPayload(): cn.partialy.pm.model.CanonicalPlaylist? = runCatching {
        gson.fromJson(getOptionalString("payload_json"), cn.partialy.pm.model.CanonicalPlaylist::class.java)
    }.getOrNull()

    private fun <T> transaction(action: (SQLiteDatabase) -> T): T {
        val db = helper.writableDatabase
        db.beginTransaction()
        try { val result = action(db); db.setTransactionSuccessful(); return result }
        finally { db.endTransaction() }
    }

    fun updateWithOutbox(playlist: CollectedPlaylist, outbox: SyncOutboxStore) = transaction { db ->
        check(playlistExists(playlist.id)) { "歌单不属于当前账号" }
        upsertPlaylist(playlist)
        outbox.enqueueInTransaction(db, account.current(), SyncPayloads.TYPE_USER_PLAYLIST,
            SyncPayloads.playlistKey(playlist), SyncPayloads.ACTION_UPSERT, SyncPayloads.playlistPayload(playlist))
    }

    fun removeWithOutbox(playlist: CollectedPlaylist, outbox: SyncOutboxStore) = transaction { db ->
        check(playlistExists(playlist.id)) { "歌单不属于当前账号" }
        removePlaylist(playlist.id)
        outbox.enqueueInTransaction(db, account.current(), SyncPayloads.TYPE_USER_PLAYLIST,
            SyncPayloads.playlistKey(playlist), SyncPayloads.ACTION_DELETE)
        markParentDeleted(db, playlist.id)
    }

    fun replaceWithOutbox(playlistId: String, songs: List<SongInfo>, outbox: SyncOutboxStore) = transaction { db ->
        check(playlistExists(playlistId)) { "歌单不属于当前账号" }
        val previous = getSongs(playlistId)
        val oldOrders = previous.associate { SyncPayloads.songKey(it) to orderOf(playlistId, it) }
        val retained = songs.map { SyncPayloads.songKey(localTracks.bind(it, db)) }.toSet()
        previous.filter { SyncPayloads.songKey(it) !in retained }.forEach {
            outbox.enqueueInTransaction(db, account.current(), SyncPayloads.TYPE_PLAYLIST_TRACK,
                SyncPayloads.playlistTrackKey(playlistId, it), SyncPayloads.ACTION_DELETE)
        }
        setSongs(playlistId, songs)
        songs.forEachIndexed { index, song ->
            val mapped = localTracks.bind(song, db)
            val old = previous.firstOrNull { SyncPayloads.songKey(it) == SyncPayloads.songKey(mapped) }
            if (old == null || old != mapped || oldOrders[SyncPayloads.songKey(mapped)] != index.toLong()) {
                outbox.enqueueInTransaction(db, account.current(), SyncPayloads.TYPE_PLAYLIST_TRACK,
                    SyncPayloads.playlistTrackKey(playlistId, mapped), SyncPayloads.ACTION_UPSERT,
                    SyncPayloads.songPayload(mapped, sortOrder = index.toLong()))
            }
        }
    }

    fun removeTracksWithOutbox(playlistId: String, removed: List<SongInfo>, outbox: SyncOutboxStore) = transaction { db ->
        check(playlistExists(playlistId)) { "歌单不属于当前账号" }
        removed.forEach { song ->
            val changed = db.delete("local_playlist_songs","account_id=? AND playlist_id=? AND song_type=? AND song_id=?",arrayOf(account.current(),playlistId,song.type.name,song.id))
            if (changed > 0) outbox.enqueueInTransaction(db,account.current(),SyncPayloads.TYPE_PLAYLIST_TRACK,
                SyncPayloads.playlistTrackKey(playlistId,song),SyncPayloads.ACTION_DELETE)
        }
    }

    fun orderOf(playlistId: String, song: SongInfo): Long? = helper.readableDatabase.rawQuery(
        "SELECT sort_order FROM local_playlist_songs WHERE account_id=? AND playlist_id=? AND song_type=? AND song_id=?",
        arrayOf(account.current(),playlistId, song.type.name, song.id),
    ).use { if (it.moveToFirst()) it.getLong(0) else null }

    fun applyTrack(playlistId: String, song: SongInfo, delete: Boolean, sortOrder: Long?, version: Long) = transaction { db ->
        if (!playlistExists(playlistId)) return@transaction
        val deleted = db.rawQuery("SELECT 1 FROM local_playlist_tombstones WHERE account_id=? AND playlist_id=?",
            arrayOf(account.current(), playlistId)).use { it.moveToFirst() }
        if (deleted) return@transaction
        val mapped = localTracks.restore(song)
        val selection = "account_id=? AND playlist_id=? AND song_type=? AND song_id=?"
        val args = arrayOf(account.current(),playlistId, mapped.type.name, mapped.id)
        if (delete) db.delete("local_playlist_songs", selection, args)
        else {
            val priorOrder = orderOf(playlistId, mapped)
            val order = sortOrder ?: priorOrder ?: queryNextSortOrder(db, playlistId).toLong()
            val values = mapped.toValues(playlistId, 0).apply {
                put("sort_order", order); put("sort_version", version)
                put("track_key", SyncPayloads.songKey(mapped))
            }
            if (db.update("local_playlist_songs", values, selection, args) == 0)
                db.insertOrThrow("local_playlist_songs", null, values)
        }
    }

    fun acknowledgeTrackVersion(playlistId: String, song: SongInfo, version: Long) {
        val mapped = localTracks.restore(song)
        helper.writableDatabase.execSQL(
            "UPDATE local_playlist_songs SET sort_version=? WHERE account_id=? AND playlist_id=? AND song_type=? AND song_id=?",
            arrayOf(version,account.current(),playlistId,mapped.type.name,mapped.id))
    }

    fun markParentDeleted(db: SQLiteDatabase = helper.writableDatabase, playlistId: String) {
        db.insertWithOnConflict("local_playlist_tombstones", null, ContentValues().apply {
            put("account_id", account.current()); put("playlist_id", playlistId)
        }, SQLiteDatabase.CONFLICT_IGNORE)
    }

    fun clearParentDeleted(playlistId: String) {
        helper.writableDatabase.delete("local_playlist_tombstones", "account_id=? AND playlist_id=?", arrayOf(account.current(), playlistId))
    }

}
