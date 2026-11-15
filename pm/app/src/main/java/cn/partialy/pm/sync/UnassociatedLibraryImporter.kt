package cn.partialy.pm.sync

import android.content.Context
import cn.partialy.pm.model.*
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import cn.partialy.pm.utils.loveUtil.FavoriteSongsDbStore
import cn.partialy.pm.utils.playlistUtil.FavoritePlaylistsDbStore
import cn.partialy.pm.utils.playlistUtil.LocalPlaylistDbStore
import java.util.UUID

/** 必须由用户明确确认后调用；保留未关联原始数据，重复导入幂等。 */
class UnassociatedLibraryImporter(private val context: Context) {
    private val helper = LocalMusicDbOpenHelper.shared(context)
    private val account = LibraryAccountScope(context)
    private val outbox = SyncOutboxStore(context)

    fun count(): Int = synchronized(AccountSessionStore.libraryBoundary) {
        val db = helper.readableDatabase
        listOf("favorite_songs", "favorite_playlists", "local_playlists").sumOf { table ->
            val column = if (table == "local_playlists") "owner_account_id" else "account_id"
            db.rawQuery("SELECT COUNT(*) FROM $table WHERE $column=''", null).use { it.moveToFirst(); it.getInt(0) }
        }
    }

    fun importInto(expectedAccount: String, expectedGeneration: Long = AccountSessionStore.libraryGeneration): Int = synchronized(AccountSessionStore.libraryBoundary) {
        check(expectedAccount.isNotBlank() && account.current() == expectedAccount && expectedGeneration == AccountSessionStore.libraryGeneration) { "账号已变化，请重新确认导入" }
        val existingSongs = FavoriteSongsDbStore(context).getSongs(expectedAccount).map { SyncPayloads.songKey(it) }.toSet()
        val favoriteSongs = FavoriteSongsDbStore(context).getSongs("").filter { SyncPayloads.songKey(it) !in existingSongs &&
            !outbox.hasPending(expectedAccount,SyncPayloads.TYPE_FAVORITE_SONG,SyncPayloads.songKey(it)) }
        val favoriteTimes = FavoriteSongsDbStore(context).favoriteTimes("")
        val existingPlaylists = FavoritePlaylistsDbStore(context).getPlaylists(expectedAccount).map { SyncPayloads.playlistKey(it) }.toSet()
        val favoritePlaylists = FavoritePlaylistsDbStore(context).getPlaylists("").filter { SyncPayloads.playlistKey(it) !in existingPlaylists &&
            !outbox.hasPending(expectedAccount,SyncPayloads.TYPE_FAVORITE_PLAYLIST,SyncPayloads.playlistKey(it)) }
        val playlists = LocalPlaylistDbStore(context)
        val originals = playlists.getPlaylists("")
        // 先读取并建立稳定映射，再进入唯一写事务，避免不同 helper 连接互相等待。
        val tracks = originals.associate { it.id to playlists.getSongs(it.id, "") }
        val db = helper.writableDatabase
        var imported = 0
        db.beginTransaction()
        try {
            for (table in listOf("favorite_songs", "favorite_playlists")) {
                val columns = db.rawQuery("PRAGMA table_info($table)", null).use { cursor ->
                    buildList { while (cursor.moveToNext()) add(cursor.getString(cursor.getColumnIndexOrThrow("name"))) }
                }
                val names = columns.joinToString(",")
                val values = columns.joinToString(",") { if (it == "account_id") "?" else it }
                val songTable = table == "favorite_songs"
                val keys = if (songTable) favoriteSongs.map { it.type.name to it.id }
                    else favoritePlaylists.map { it.type.name to it.id }
                val typeColumn = if (songTable) "song_type" else "playlist_type"
                val idColumn = if (songTable) "song_id" else "playlist_id"
                keys.forEach { (type,id) ->
                    db.execSQL("INSERT OR IGNORE INTO $table ($names) SELECT $values FROM $table WHERE account_id='' AND $typeColumn=? AND $idColumn=?", arrayOf(expectedAccount,type,id))
                }
            }
            favoriteSongs.filter { it.type != SongType.LOCAL }.forEach { song ->
                if (!outbox.hasPending(expectedAccount, SyncPayloads.TYPE_FAVORITE_SONG, SyncPayloads.songKey(song))) {
                    outbox.enqueueInTransaction(db,expectedAccount,SyncPayloads.TYPE_FAVORITE_SONG,
                        SyncPayloads.songKey(song),SyncPayloads.ACTION_UPSERT,
                        SyncPayloads.songPayload(song,favoriteTimes["${song.type.name}:${song.id}"]))
                }
            }
            favoritePlaylists.forEach { playlist ->
                if (!outbox.hasPending(expectedAccount, SyncPayloads.TYPE_FAVORITE_PLAYLIST, SyncPayloads.playlistKey(playlist))) {
                    outbox.enqueueInTransaction(db,expectedAccount,SyncPayloads.TYPE_FAVORITE_PLAYLIST,
                        SyncPayloads.playlistKey(playlist),SyncPayloads.ACTION_UPSERT,SyncPayloads.playlistPayload(playlist))
                }
            }
            for (original in originals) {
                val existing = db.rawQuery("SELECT 1 FROM unassociated_library_imports WHERE account_id=? AND source_playlist_id=?",
                    arrayOf(expectedAccount,original.id)).use { it.moveToFirst() }
                if (existing) continue
                val id = UUID.randomUUID().toString()
                val copy = original.copy(id=id)
                val columns = "source,name,desc,intro,cover,payload_json,created_at,updated_at"
                db.execSQL("INSERT INTO local_playlists(id,owner_account_id,$columns) SELECT ?,?,$columns FROM local_playlists WHERE id=? AND owner_account_id=''",
                    arrayOf(id,expectedAccount,original.id))
                db.execSQL("UPDATE local_playlists SET payload_json=? WHERE id=? AND owner_account_id=?",
                    arrayOf(com.google.gson.Gson().toJson(copy.toCanonicalPlaylist()),id,expectedAccount))
                val songColumns = "song_id,source,url_param,song_type,name,singer,artist,cover,cover_url,album,lyric,duration,payload_json,sort_order,updated_at,sort_version,track_key"
                db.execSQL("INSERT INTO local_playlist_songs(account_id,playlist_id,$songColumns) SELECT ?,?,$songColumns FROM local_playlist_songs WHERE playlist_id=? AND account_id=''", arrayOf(expectedAccount,id,original.id))
                db.execSQL("INSERT INTO unassociated_library_imports(account_id,source_playlist_id,target_playlist_id) VALUES(?,?,?)",arrayOf(expectedAccount,original.id,id))
                outbox.enqueueInTransaction(db,expectedAccount,SyncPayloads.TYPE_USER_PLAYLIST,
                    SyncPayloads.playlistKey(copy),SyncPayloads.ACTION_UPSERT,SyncPayloads.playlistPayload(copy))
                tracks[original.id].orEmpty().forEachIndexed { index,song ->
                    outbox.enqueueInTransaction(db,expectedAccount,SyncPayloads.TYPE_PLAYLIST_TRACK,
                        SyncPayloads.playlistTrackKey(id,song),SyncPayloads.ACTION_UPSERT,
                        SyncPayloads.songPayload(song,sortOrder=index.toLong()))
                }
                imported++
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
        // 手动导入可能晚于启动任务排空；只在事务提交后唤醒新副本的持久封面队列。
        cn.partialy.pm.playlistcover.PlaylistCoverWork.request(context)
        imported + favoriteSongs.size + favoritePlaylists.size
    }
}
