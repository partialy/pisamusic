package cn.partialy.pm.sync

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.ServerDevicePrefs
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import java.io.File
import java.util.UUID

/** 同步逻辑身份与播放引用分离；删除扫描索引不会删除此长期私有映射。 */
internal class LocalSyncTrackStore(private val context: Context) {
    private val helper = LocalMusicDbOpenHelper.shared(context)

    fun bind(song: SongInfo, transaction: SQLiteDatabase? = null): SongInfo {
        if (song.type != SongType.LOCAL) return song
        if (isSyncId(song.id)) return restore(song)
        val db = transaction ?: helper.writableDatabase
        val syncId = db.rawQuery("SELECT sync_track_id FROM local_sync_track_map WHERE local_song_key=?", arrayOf(song.id)).use {
            if (it.moveToFirst()) it.getString(0) else null
        } ?: run {
            val candidate = "${deviceScope()}:${UUID.randomUUID()}"
            db.insertWithOnConflict("local_sync_track_map", null, ContentValues().apply {
                put("local_song_key", song.id); put("playback_id", song.id)
                put("sync_track_id", candidate); put("duration_ms", song.durationMs)
                put("created_at", System.currentTimeMillis())
            }, SQLiteDatabase.CONFLICT_IGNORE)
            db.rawQuery("SELECT sync_track_id FROM local_sync_track_map WHERE local_song_key=?", arrayOf(song.id)).use {
                check(it.moveToFirst()) { "保存本地歌曲同步映射失败" }; it.getString(0)
            }
        }
        return song.copy(localSyncId = syncId, embeddedCoverArt = null)
    }

    fun restore(song: SongInfo): SongInfo {
        if (song.type != SongType.LOCAL) return song
        if (!isSyncId(song.id)) return bind(song).copy(playable = readable(song.id))
        val playback = helper.readableDatabase.rawQuery(
            "SELECT playback_id FROM local_sync_track_map WHERE sync_track_id=?", arrayOf(song.id),
        ).use { if (it.moveToFirst()) it.getString(0) else null }
        return if (playback != null) {
            song.copy(id = playback, localSyncId = song.id, playable = readable(playback))
        } else song.copy(localSyncId = song.id, playable = false)
    }

    private fun readable(reference: String): Boolean = runCatching {
        when {
            reference.startsWith("content:") -> context.contentResolver.openFileDescriptor(Uri.parse(reference), "r")?.use { true } ?: false
            reference.startsWith("file:") -> File(Uri.parse(reference).path.orEmpty()).let { it.isFile && it.canRead() }
            else -> File(reference).let { it.isFile && it.canRead() }
        }
    }.getOrDefault(false)

    private fun deviceScope(): String {
        val prefs = context.getSharedPreferences("pm_local_sync_identity", Context.MODE_PRIVATE)
        synchronized(LocalSyncTrackStore::class.java) {
            prefs.getString("scope_uuid", null)?.takeIf { uuid(it) }?.let { return it }
            val scope = ServerDevicePrefs.getDeviceId(context).takeIf { uuid(it) } ?: UUID.randomUUID().toString()
            check(prefs.edit().putString("scope_uuid", scope).commit()) { "无法保存本地歌曲设备标识" }
            return scope
        }
    }

    companion object {
        private fun uuid(value: String): Boolean = runCatching { UUID.fromString(value).toString().equals(value, true) }.getOrDefault(false)
        fun isSyncId(value: String): Boolean = value.split(':').let { it.size == 2 && uuid(it[0]) && uuid(it[1]) }
    }
}
