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
        syncNow()
        SyncPrefs.getState(context)
    }

    suspend fun syncNow(): SyncPrefs.State = withContext(Dispatchers.IO) {
        mutex.withLock {
            val before = prepareAccountState() ?: return@withLock SyncPrefs.getState(context)
            try {
                var appliedVersion = before.lastVersion
                while (true) {
                    val pulled = configManager.getSyncChanges(before.token, deviceId(), appliedVersion)
                    if (!isCurrentAccount(before.userId)) return@withLock SyncPrefs.getState(context)
                    // 响应 version 是账号全局版本；单页最多 1000 条，不能直接跳过未返回的日志。
                    val pageStart = appliedVersion
                    for (change in pulled.changes) {
                        check(change.version > appliedVersion) { "同步日志版本顺序异常" }
                        if (!isCurrentAccount(before.userId)) return@withLock SyncPrefs.getState(context)
                        applyRemoteChange(change, before.userId)
                        appliedVersion = change.version
                    }
                    if (appliedVersion >= pulled.version) break
                    check(appliedVersion > pageStart) { "同步日志分页缺失，请稍后重试" }
                }

                // 分批排空；旧收藏 seed 较多时，排在后面的取消操作也必须本轮送达。
                while (isCurrentAccount(before.userId)) {
                    val pending = outbox.listPending(before.userId)
                    if (pending.isEmpty()) break
                    val changes = pending.map { op ->
                        op.toChangeInput(SyncPayloads.parseJsonObject(op.payloadJson))
                    }
                    if (!isCurrentAccount(before.userId)) return@withLock SyncPrefs.getState(context)
                    configManager.pushSyncChanges(before.token, deviceId(), changes)
                    if (!isCurrentAccount(before.userId)) return@withLock SyncPrefs.getState(context)
                    outbox.removeOps(pending.map { it.opId })
                }

                // push 的版本可能包含尚未拉取的其他设备变更，游标只能推进到已应用的 pull 版本。
                if (isCurrentAccount(before.userId)) {
                    SyncPrefs.markSyncSuccess(context, before.userId, appliedVersion)
                }
            } catch (e: Exception) {
                if (isCurrentAccount(before.userId)) {
                    SyncPrefs.markSyncError(context, before.userId, e.message ?: "同步失败")
                }
            }
            SyncPrefs.getState(context)
        }
    }

    private fun prepareAccountState(): SyncPrefs.State? {
        val state = SyncPrefs.getState(context)
        if (!state.loggedIn) return null
        outbox.clearForAccountBoundary(state.userId)
        if (state.needsAccountSeed) {
            SyncPrefs.resetForAccount(context, state.userId)
            seedInitialOutbox(state.userId)
        }
        return SyncPrefs.getState(context)
    }

    fun clearLocalSyncState() {
        outbox.clearAll()
        SyncPrefs.clearAccountState(context)
    }

    private fun isCurrentAccount(accountId: String): Boolean =
        SyncPrefs.getState(context).let { it.loggedIn && it.userId == accountId }

    private fun seedInitialOutbox(accountId: String) {
        loveManager.seedSyncOutbox(accountId)

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

    private fun applyRemoteChange(change: cn.partialy.pm.model.SyncChange, accountId: String) {
        when (change.itemType) {
            SyncPayloads.TYPE_FAVORITE_SONG -> applyFavoriteSong(change.itemKey, change.action, change.payload, accountId)
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

    private fun applyFavoriteSong(itemKey: String, action: String, payload: Any?, accountId: String) {
        val song = SyncPayloads.parseSong(payload, itemKey) ?: SyncPayloads.songFromKey(itemKey) ?: return
        if (song.source == "local") return
        if (action == SyncPayloads.ACTION_DELETE) {
            loveManager.removeFromSync(song, accountId)
        } else {
            loveManager.upsertFromSync(song, accountId)
        }
    }

    private fun applyPlaylist(itemKey: String, action: String, payload: Any?, favorite: Boolean) {
        val playlist = SyncPayloads.parsePlaylist(payload, itemKey) ?: SyncPayloads.playlistFromKey(itemKey) ?: return
        if (action == SyncPayloads.ACTION_DELETE) {
            playlistCollectionManager.removePlaylistFromSync(playlist, favorite)
        } else {
            playlistCollectionManager.upsertPlaylistFromSync(clearLocalFileCover(playlist), favorite)
        }
    }

    private fun applyPlaylistTrack(itemKey: String, action: String, payload: Any?) {
        val keyParts = SyncPayloads.playlistTrackFromKey(itemKey) ?: return
        val song = SyncPayloads.parseSong(payload, itemKey.substringAfter("|", "")) ?: keyParts.second
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
