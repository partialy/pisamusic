package cn.partialy.pm.sync

import android.content.Context
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.utils.ServerDevicePrefs
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
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
    private val coverUploads: cn.partialy.pm.playlistcover.PlaylistCoverUploadManager,
) {
    private val outbox = SyncOutboxStore(context)
    private val helper by lazy { LocalMusicDbOpenHelper.shared(context.applicationContext) }
    private val mutex = Mutex()
    private var syncGeneration = -1L
    private val favoriteApplier = FavoriteSongSyncApplier(loveManager)
    private val playlistApplier = PlaylistSyncApplier(playlistCollectionManager, outbox)

    fun state(): SyncPrefs.State = SyncPrefs.getState(context)

    suspend fun startAccountSync(): SyncPrefs.State = withContext(Dispatchers.IO) {
        syncNow()
        SyncPrefs.getState(context)
    }

    suspend fun syncNow(): SyncPrefs.State = withContext(Dispatchers.IO) {
        mutex.withLock {
            syncGeneration = cn.partialy.pm.network.auth.AccountSessionStore.libraryGeneration
            val before = prepareAccountState() ?: return@withLock SyncPrefs.getState(context)
            try {
                var appliedVersion = pull(before, before.lastVersion)
                var pushed = false
                var pushSkipped = false

                // 分批排空；旧收藏 seed 较多时，排在后面的取消操作也必须本轮送达。
                while (isCurrentAccount(before.userId)) {
                    val pending = outbox.coalescedPending(before.userId)
                    if (pending.changes.isEmpty()) break
                    val changes = pending.changes.map { op ->
                        op.toChangeInput(SyncPayloads.parseJsonObject(op.payloadJson))
                    }
                    if (!isCurrentAccount(before.userId)) return@withLock SyncPrefs.getState(context)
                    val result = try {
                        configManager.pushSyncChanges(before.token, deviceId(), changes)
                    } catch (e: ConfigManager.ApiException) {
                        if ((e.httpStatus == 400 || e.code == 400) && coverUploads.recoverRejectedResources(before.userId, pending.changes)) continue
                        throw e
                    }
                    result.serverTime?.let { SyncPrefs.updateServerClock(context, before.userId, it) }
                    pushSkipped = pushSkipped || result.skipped > 0
                    if (!isCurrentAccount(before.userId)) return@withLock SyncPrefs.getState(context)
                    outbox.removeOps(
                        opIds = pending.opIds,
                        accountId = before.userId,
                        appliedItems = result.appliedItems,
                        rejectedItems = result.rejectedItems,
                        actionByOpId = pending.changes.associate { it.opId to it.action },
                    )
                    pushed = true
                }

                // 被 pending 遮挡的远端变更必须在 push 后重放，覆盖服务端 LWW 拒绝的本机旧值；无冲突时从 appliedVersion 继续，避免全量双拉。
                if (pushed && isCurrentAccount(before.userId)) {
                    appliedVersion = pull(before, if (pushSkipped) 0L else appliedVersion)
                }

                if (isCurrentAccount(before.userId)) {
                    SyncPrefs.markSyncSuccess(context, before.userId, appliedVersion)
                    SyncClockAndStateStore.pruneOpHistory(helper.writableDatabase, before.userId)
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                if (isCurrentAccount(before.userId)) {
                    SyncPrefs.markSyncError(context, before.userId, e.message ?: "同步失败")
                    SyncWorkRunner.scheduleRetry(context)
                }
            }
            SyncPrefs.getState(context)
        }
    }

    private suspend fun pull(before: SyncPrefs.State, since: Long): Long {
        var appliedVersion = since
        val ownDeviceId = deviceId()
        val initialSongs = loveManager.getLoveList()
        val initialPlaylists = playlistApplier.localItems()
        var snapshotVersion: Long? = null
        var cursor: String? = null
        val snapshot = mutableListOf<cn.partialy.pm.model.SyncChange>()
        val seenCursors = hashSetOf<String>()
        var snapshotRestarts = 0
        while (true) {
            val pulled = try {
                configManager.getSyncChanges(
                    before.token,
                    ownDeviceId,
                    if (snapshotVersion != null) 0 else appliedVersion,
                    snapshotVersion,
                    cursor,
                )
            } catch (e: ConfigManager.ApiException) {
                if (e.httpStatus != 409 || snapshotRestarts++ >= 2) throw e
                snapshotVersion = null
                cursor = null
                snapshot.clear()
                seenCursors.clear()
                appliedVersion = 0
                continue
            }
            pulled.serverTime?.let { SyncPrefs.updateServerClock(context, before.userId, it) }
            if (!isCurrentAccount(before.userId)) return appliedVersion
            if (pulled.mode == "snapshot") {
                val version = pulled.snapshotVersion ?: pulled.version
                check(snapshotVersion == null || snapshotVersion == version) { "同步快照版本已变化，请重试" }
                snapshotVersion = version
                snapshot += pulled.items ?: pulled.changes
                if (pulled.hasMore) {
                    cursor = pulled.cursor?.takeIf { it.isNotBlank() && seenCursors.add(it) }
                        ?: error("同步快照分页缺失")
                    continue
                }
                // 只在完整权威快照到齐后发布；业务写入、实体版本与游标水位同库落盘。
                loveManager.withSyncBatch {
                    if (!isCurrentAccount(before.userId)) return@withSyncBatch
                    snapshot.sortedBy { if (it.itemType == SyncPayloads.TYPE_PLAYLIST_TRACK) 1 else 0 }
                        .forEach { applyRemoteChange(it, before.userId) }
                    loveManager.reconcileSnapshot(
                        snapshot.filter { it.itemType == SyncPayloads.TYPE_FAVORITE_SONG }
                            .mapTo(hashSetOf()) { it.itemKey },
                        initialSongs,
                        before.userId,
                    )
                    playlistApplier.reconcile(snapshot.mapTo(hashSetOf()) { it.itemType to it.itemKey }, initialPlaylists, before.userId)
                    recordSnapshotVersionsAndWatermark(before.userId, snapshot, version)
                }
                appliedVersion = version
                break
            }
            check(snapshotVersion == null) { "同步快照模式异常" }
            val pageStart = appliedVersion
            for (change in pulled.changes) {
                check(change.version > appliedVersion) { "同步日志版本顺序异常" }
                if (!isCurrentAccount(before.userId)) return appliedVersion
                if (change.deviceId != ownDeviceId) applyRemoteChange(change, before.userId)
                else synchronized(cn.partialy.pm.network.auth.AccountSessionStore.libraryBoundary) {
                    if (isCurrentAccount(before.userId)) playlistApplier.acknowledgeOwnVersion(change, before.userId)
                }
                appliedVersion = change.version
            }
            if (pulled.changes.isNotEmpty() && isCurrentAccount(before.userId)) {
                recordDeltaVersionsAndWatermark(before.userId, pulled.changes, appliedVersion)
            }
            if (appliedVersion >= pulled.version) break
            check(appliedVersion > pageStart) { "同步日志分页缺失，请稍后重试" }
        }
        return appliedVersion
    }

    private fun recordSnapshotVersionsAndWatermark(
        accountId: String,
        snapshot: List<cn.partialy.pm.model.SyncChange>,
        version: Long,
    ) {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            SyncClockAndStateStore.clearEntityVersions(db, accountId)
            for (item in snapshot) {
                SyncClockAndStateStore.upsertEntityVersion(
                    db = db,
                    accountId = accountId,
                    itemType = item.itemType,
                    itemKey = item.itemKey,
                    serverVersion = item.version,
                    deleted = item.action == SyncPayloads.ACTION_DELETE,
                )
            }
            SyncClockAndStateStore.markSyncSuccess(db, accountId, version)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun recordDeltaVersionsAndWatermark(
        accountId: String,
        changes: List<cn.partialy.pm.model.SyncChange>,
        version: Long,
    ) {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            for (change in changes) {
                SyncClockAndStateStore.upsertEntityVersion(
                    db = db,
                    accountId = accountId,
                    itemType = change.itemType,
                    itemKey = change.itemKey,
                    serverVersion = change.version,
                    deleted = change.action == SyncPayloads.ACTION_DELETE,
                )
            }
            SyncClockAndStateStore.markSyncSuccess(db, accountId, version)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun prepareAccountState(): SyncPrefs.State? = synchronized(cn.partialy.pm.network.auth.AccountSessionStore.libraryBoundary) {
        val state = SyncPrefs.getState(context)
        if (!state.loggedIn) return null
        if (state.needsAccountSeed) {
            SyncPrefs.resetForAccount(context, state.userId)
            seedInitialOutbox(state.userId)
        }
        return SyncPrefs.getState(context)
    }

    /** 清空与同步串行，丢弃旧 pending，保留账号绑定以禁止下轮重新 seed。 */
    suspend fun clearLocalDataOnly() = withContext(Dispatchers.IO) {
        mutex.withLock {
            loveManager.withDataLock {
                playlistCollectionManager.withDataLock {
                    loveManager.clearLoveList()
                    playlistCollectionManager.clearAll()
                    outbox.clearAccount(outbox.accountSnapshot())
                }
            }
            val state = SyncPrefs.getState(context)
            if (state.loggedIn) SyncPrefs.resetForAccount(context, state.userId)
        }
    }

    fun clearLocalSyncState() {
        // 各账号水位和 seeded 状态已按 account_id 隔离保留在 SQLite sync_account_state 中，登出/切号不再清空避免重登误 re-seed。
    }

    private fun isCurrentAccount(accountId: String): Boolean =
        SyncPrefs.getState(context).let {
            it.loggedIn && it.userId == accountId &&
                syncGeneration == cn.partialy.pm.network.auth.AccountSessionStore.libraryGeneration
        }

    private fun seedInitialOutbox(accountId: String) {
        favoriteApplier.seed(accountId)
        playlistApplier.seed(accountId)
    }

    private fun applyRemoteChange(change: cn.partialy.pm.model.SyncChange, accountId: String) =
        synchronized(cn.partialy.pm.network.auth.AccountSessionStore.libraryBoundary) {
            if (!isCurrentAccount(accountId)) return@synchronized
            if (change.itemType == SyncPayloads.TYPE_FAVORITE_SONG) favoriteApplier.apply(change, accountId)
            else playlistApplier.apply(change, accountId, change.deviceId == deviceId())
        }

    private fun deviceId(): String {
        val serverId = ServerDevicePrefs.getDeviceId(context).trim()
        if (serverId.isNotBlank()) return serverId
        val prefs = context.getSharedPreferences("pm_sync_device", Context.MODE_PRIVATE)
        synchronized(SyncManager::class.java) {
            return prefs.getString("uuid", null)?.takeIf { it.isNotBlank() } ?: java.util.UUID.randomUUID().toString().also {
                check(prefs.edit().putString("uuid", it).commit()) { "无法保存同步设备标识" }
            }
        }
    }
}
