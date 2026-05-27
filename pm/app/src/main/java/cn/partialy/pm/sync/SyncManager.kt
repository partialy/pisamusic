package cn.partialy.pm.sync

import android.content.Context
import android.os.Build
import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.CanonicalSong
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.utils.ServerDevicePrefs
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val configManager: ConfigManager,
    private val loveManager: LoveManager,
    private val playlistCollectionManager: PlaylistCollectionManager,
) {
    private val outbox = SyncOutboxStore(context)
    private val mutex = Mutex()

    fun state(): SyncPrefs.State = SyncPrefs.getState(context)

    suspend fun startAccountSync(): SyncPrefs.State = withContext(Dispatchers.IO) {
        if (!SyncPrefs.getState(context).bound) return@withContext SyncPrefs.getState(context)
        seedInitialOutbox()
        syncNow()
        SyncPrefs.getState(context)
    }

    @Deprecated("账号同步已取代同步码，保留用于旧入口编译兼容")
    suspend fun createSyncSpace(): SyncPrefs.State = startAccountSync()

    @Deprecated("账号同步已取代同步码，保留用于旧入口编译兼容")
    suspend fun joinSyncSpace(syncCode: String): SyncPrefs.State = startAccountSync()

    @Deprecated("账号同步已取代同步码，保留用于旧入口编译兼容")
    suspend fun unbind(): SyncPrefs.State = SyncPrefs.getState(context)

    suspend fun syncNow(): SyncPrefs.State = withContext(Dispatchers.IO) {
        mutex.withLock {
            val before = SyncPrefs.getState(context)
            if (!before.bound) return@withLock before
            try {
                val pulled = configManager.getSyncChanges(before.token, deviceId(), before.lastVersion)
                pulled.changes.forEach { change -> applyRemoteChange(change) }
                var version = pulled.version

                val pending = outbox.listPending()
                if (pending.isNotEmpty()) {
                    val changes = pending.map { op ->
                        op.toChangeInput(SyncPayloads.parseJsonObject(op.payloadJson))
                    }
                    val pushed = configManager.pushSyncChanges(before.token, deviceId(), changes)
                    outbox.removeOps(pending.map { it.opId })
                    version = maxOf(version, pushed.version)
                }

                SyncPrefs.markSyncSuccess(context, version)
            } catch (e: Exception) {
                SyncPrefs.markSyncError(context, e.message ?: "同步失败")
            }
            SyncPrefs.getState(context)
        }
    }

    private fun seedInitialOutbox() {
        loveManager.getLoveList()
            .filter { it.type != SongType.LOCAL }
            .forEach { song ->
                outbox.enqueue(
                    itemType = SyncPayloads.TYPE_FAVORITE_SONG,
                    itemKey = SyncPayloads.songKey(song),
                    action = SyncPayloads.ACTION_UPSERT,
                    payloadJson = SyncPayloads.songPayload(song),
                )
            }

        playlistCollectionManager.getAllPlaylists().forEach { playlist ->
            if (playlist.type == CollectedPlaylistType.LOCAL) {
                outbox.enqueue(
                    itemType = SyncPayloads.TYPE_USER_PLAYLIST,
                    itemKey = SyncPayloads.playlistKey(playlist),
                    action = SyncPayloads.ACTION_UPSERT,
                    payloadJson = SyncPayloads.playlistPayload(playlist),
                )
                playlistCollectionManager.getLocalPlaylistSongs(playlist.id)
                    .filter { it.type != SongType.LOCAL }
                    .forEach { song ->
                        outbox.enqueue(
                            itemType = SyncPayloads.TYPE_PLAYLIST_TRACK,
                            itemKey = SyncPayloads.playlistTrackKey(playlist.id, song),
                            action = SyncPayloads.ACTION_UPSERT,
                            payloadJson = SyncPayloads.songPayload(song),
                        )
                    }
            } else {
                outbox.enqueue(
                    itemType = SyncPayloads.TYPE_FAVORITE_PLAYLIST,
                    itemKey = SyncPayloads.playlistKey(playlist),
                    action = SyncPayloads.ACTION_UPSERT,
                    payloadJson = SyncPayloads.playlistPayload(playlist),
                )
            }
        }
    }

    private fun applyRemoteChange(change: cn.partialy.pm.model.SyncChange) {
        when (change.itemType) {
            SyncPayloads.TYPE_FAVORITE_SONG -> applyFavoriteSong(change.itemKey, change.action, change.payload)
            SyncPayloads.TYPE_FAVORITE_PLAYLIST -> applyPlaylist(
                itemKey = change.itemKey,
                action = change.action,
                payload = change.payload,
                favorite = true,
            )
            SyncPayloads.TYPE_USER_PLAYLIST -> applyPlaylist(
                itemKey = change.itemKey,
                action = change.action,
                payload = change.payload,
                favorite = false,
            )
            SyncPayloads.TYPE_PLAYLIST_TRACK -> applyPlaylistTrack(change.itemKey, change.action, change.payload)
        }
    }

    private fun applyFavoriteSong(itemKey: String, action: String, payload: Any?) {
        val song = SyncPayloads.parseSong(payload) ?: SyncPayloads.songFromKey(itemKey) ?: return
        if (song.source == "local") return
        if (action == SyncPayloads.ACTION_DELETE) {
            loveManager.removeFromSync(song)
        } else {
            loveManager.upsertFromSync(song)
        }
    }

    private fun applyPlaylist(itemKey: String, action: String, payload: Any?, favorite: Boolean) {
        val playlist = SyncPayloads.parsePlaylist(payload) ?: SyncPayloads.playlistFromKey(itemKey) ?: return
        if (action == SyncPayloads.ACTION_DELETE) {
            playlistCollectionManager.removePlaylistFromSync(playlist, favorite)
        } else {
            playlistCollectionManager.upsertPlaylistFromSync(clearLocalFileCover(playlist), favorite)
        }
    }

    private fun applyPlaylistTrack(itemKey: String, action: String, payload: Any?) {
        val keyParts = SyncPayloads.playlistTrackFromKey(itemKey) ?: return
        val song = SyncPayloads.parseSong(payload) ?: keyParts.second
        if (song.source == "local") return
        if (action == SyncPayloads.ACTION_DELETE) {
            playlistCollectionManager.removeTrackFromSync(keyParts.first, song)
        } else {
            playlistCollectionManager.addTrackFromSync(keyParts.first, song)
        }
    }

    private fun clearLocalFileCover(playlist: CanonicalPlaylist): CanonicalPlaylist {
        if (playlist.source != "local") return playlist
        val cover = playlist.cover.trim().lowercase()
        if (!cover.startsWith("file:") && !cover.startsWith("local_file:")) return playlist
        return playlist.copy(cover = "")
    }

    private fun deviceId(): String {
        val serverId = ServerDevicePrefs.getDeviceId(context).trim()
        if (serverId.isNotBlank()) return serverId
        val model = listOf(Build.MANUFACTURER, Build.MODEL).joinToString("-").trim()
        return model.ifBlank { "android" }
    }
}
