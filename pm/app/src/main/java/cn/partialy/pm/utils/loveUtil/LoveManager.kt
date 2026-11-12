package cn.partialy.pm.utils.loveUtil

import android.content.Context
import android.util.Log
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.decodeSongInfoListCompat
import cn.partialy.pm.model.toSongInfo
import cn.partialy.pm.sync.SyncOutboxStore
import cn.partialy.pm.sync.SyncPayloads
import cn.partialy.pm.sync.SyncWorkRunner
import com.google.gson.Gson
import com.google.gson.JsonParser
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LoveManager @Inject constructor(@ApplicationContext private val context: Context) {
    private val gson = Gson()
    private val fileName = "loveList.json"
    private val db = FavoriteSongsDbStore(context)
    private val syncOutbox = SyncOutboxStore(context)
    private val lock = Any()
    private var loaded = false
    private var syncBatchDepth = 0
    private var latestFavoriteTime = 0L
    private val songsByKey = LinkedHashMap<String, SongInfo>()
    private val favoriteTimes = HashMap<String, Long>()

    private val _loveListFlow = MutableStateFlow<List<SongInfo>>(emptyList())
    val loveListFlow: StateFlow<List<SongInfo>> = _loveListFlow.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val migrationPrefs = context.getSharedPreferences("pm_favorite_migration", Context.MODE_PRIVATE)

    private fun loveFile(): File = File(context.filesDir, fileName)

    private fun readListFromDisk(): List<SongInfo> {
        return try {
            val file = loveFile()
            if (!file.exists()) return emptyList()
            val content = file.readText()
            if (content.isBlank()) return emptyList()
            val root = JsonParser().parse(content)
            check(root.isJsonArray) { "旧版收藏格式错误" }
            gson.decodeSongInfoListCompat(content).also {
                check(it.size == root.asJsonArray.size()) { "旧版收藏存在无法解析的数据" }
            }
        } catch (e: Exception) {
            Log.e(TAG, "read love list failed", e)
            throw IllegalStateException("读取旧版收藏失败，未完成迁移", e)
        }
    }

    private fun ensureLoaded() {
        synchronized(lock) {
            if (loaded) return
            if (!migrationPrefs.getBoolean("sqlite_authoritative", false)) {
                if (!db.hasAuthoritativeData()) {
                    db.mergeLegacySongs(readListFromDisk().map { it.forPersistence() })
                }
                // 完成标记同步落盘后才开放读写，避免下次启动重新合并已取消的收藏。
                check(migrationPrefs.edit().putBoolean("sqlite_authoritative", true).commit()) {
                    "无法保存收藏迁移状态"
                }
            }
            loveFile().takeIf { it.exists() }?.delete()
            val list = db.getSongs()
            favoriteTimes.clear()
            favoriteTimes.putAll(db.favoriteTimes())
            latestFavoriteTime = favoriteTimes.values.maxOrNull() ?: 0L
            songsByKey.clear()
            for (s in list) songsByKey[s.storageKey()] = s
            refreshFlowLocked()
            loaded = true
        }
    }

    /** 强制从磁盘重新加载（数据管理导入后调用） */
    fun reload() {
        synchronized(lock) {
            loaded = false
            ensureLoaded()
        }
    }

    /** 在 IO 线程读盘预热内存（仅首次有效），供主界面启动后调用，减轻首点收藏页时主线程压力。 */
    fun preloadFromDiskAsync() {
        scope.launch {
            ensureLoaded()
        }
    }

    suspend fun awaitPreloaded() = kotlinx.coroutines.withContext(Dispatchers.IO) { ensureLoaded() }

    private fun refreshFlowLocked() {
        if (syncBatchDepth > 0) return
        _loveListFlow.value = orderedSongsLocked()
    }

    private fun orderedSongsLocked(): List<SongInfo> = songsByKey.values.sortedByDescending { favoriteTimes[it.storageKey()] ?: 0L }

    /** 批量插入只更新索引，最后统一排序发布，避免逐项重建 Map。 */
    private fun nextFavoriteTimeLocked(): Long = maxOf(System.currentTimeMillis(), latestFavoriteTime + 1).also { latestFavoriteTime = it }

    private fun putNewestFirstLocked(song: SongInfo, createdAt: Long) {
        val key = song.storageKey()
        songsByKey[key] = song
        favoriteTimes[key] = createdAt
    }

    fun getLoveList(): List<SongInfo> {
        ensureLoaded()
        synchronized(lock) {
            return orderedSongsLocked()
        }
    }

    /** Strip embedded cover bytes for LOCAL tracks before JSON (avoids huge base64 in file). */
    private fun SongInfo.forPersistence(): SongInfo {
        if (type != SongType.LOCAL) return this
        if (embeddedCoverArt == null) return this
        return copy(embeddedCoverArt = null)
    }

    fun exportBackupBytes(): ByteArray = gson.toJson(getLoveList().map { it.forPersistence() }).toByteArray(Charsets.UTF_8)

    fun importSongs(songs: List<SongInfo>): Int {
        ensureLoaded()
        val added = synchronized(lock) {
            val count = db.mergeLegacySongs(songs.map { it.forPersistence() }, syncOutbox.accountSnapshot())
            reload()
            count
        }
        if (added > 0) SyncWorkRunner.request(context)
        return added
    }

    fun toggleLikeStatus(songInfo: SongInfo): Boolean {
        ensureLoaded()
        val liked = synchronized(lock) {
            if (songsByKey.containsKey(songInfo.storageKey())) {
                if (db.removeSong(songInfo, syncOutbox.accountSnapshot())) {
                    songsByKey.remove(songInfo.storageKey())
                    favoriteTimes.remove(songInfo.storageKey())
                }
            } else {
                val createdAt = nextFavoriteTimeLocked()
                if (db.addSong(songInfo.forPersistence(), syncOutbox.accountSnapshot(), createdAt)) {
                    putNewestFirstLocked(songInfo.forPersistence(), createdAt)
                }
            }
            favoriteTimes.putAll(db.favoriteTimes())
            refreshFlowLocked()
            songsByKey.containsKey(songInfo.storageKey())
        }
        SyncWorkRunner.request(context)
        return liked
    }

    fun isSongInLoveList(songInfo: SongInfo): Boolean {
        ensureLoaded()
        synchronized(lock) {
            return songsByKey.containsKey(songInfo.storageKey())
        }
    }

    fun removeSongsFromLoveList(songs: Collection<SongInfo>): Int {
        if (songs.isEmpty()) return 0
        ensureLoaded()
        var removedCount = 0
        synchronized(lock) {
            val accountId = syncOutbox.accountSnapshot()
            for (song in songs.distinctBy { it.storageKey() }) {
                if (db.removeSong(song, accountId)) {
                    songsByKey.remove(song.storageKey())
                    favoriteTimes.remove(song.storageKey())
                    removedCount++
                }
            }
            if (removedCount > 0) {
                refreshFlowLocked()
            }
        }
        if (removedCount > 0) {
            SyncWorkRunner.request(context)
        }
        return removedCount
    }

    data class BatchAddResult(
        val added: List<SongInfo>,
        val existing: List<SongInfo>,
        val failed: List<SongInfo>,
    )

    /** 幂等添加；只为新增项写同步事件，集中排序刷新列表。 */
    fun addSongsToLoveList(songs: Collection<SongInfo>): BatchAddResult {
        ensureLoaded()
        val added = mutableListOf<SongInfo>()
        val existing = mutableListOf<SongInfo>()
        val failed = mutableListOf<SongInfo>()
        synchronized(lock) {
            val accountId = syncOutbox.accountSnapshot()
            for (song in songs.distinctBy { it.storageKey() }) {
                if (song.id.isBlank()) {
                    failed.add(song)
                    continue
                }
                val createdAt = nextFavoriteTimeLocked()
                try {
                    if (songsByKey.containsKey(song.storageKey())) {
                        existing.add(song)
                    } else if (db.addSong(song.forPersistence(), accountId, createdAt)) {
                        putNewestFirstLocked(song.forPersistence(), createdAt)
                        added.add(song)
                    } else if (db.contains(song)) {
                        songsByKey[song.storageKey()] = song.forPersistence()
                        existing.add(song)
                    } else failed.add(song)
                } catch (_: Exception) {
                    failed.add(song)
                }
            }
            favoriteTimes.putAll(db.favoriteTimes())
            refreshFlowLocked()
        }
        if (added.isNotEmpty()) {
            SyncWorkRunner.request(context)
        }
        return BatchAddResult(added, existing, failed)
    }

    fun upsertFromSync(song: cn.partialy.pm.model.CanonicalSong, accountId: String) {
        val next = song.toSongInfo().forPersistence()
        if (next.type == SongType.LOCAL || next.id.isBlank()) return
        ensureLoaded()
        synchronized(lock) {
            if (shouldKeepLocalChange(next, accountId)) return
            favoriteTimes[next.storageKey()] = db.upsertSongFromSync(next, song.favoritedAt)
            latestFavoriteTime = maxOf(latestFavoriteTime, favoriteTimes[next.storageKey()] ?: 0L)
            songsByKey[next.storageKey()] = next
            refreshFlowLocked()
        }
    }

    fun removeFromSync(song: cn.partialy.pm.model.CanonicalSong, accountId: String) {
        val next = song.toSongInfo()
        if (next.id.isBlank()) return
        ensureLoaded()
        synchronized(lock) {
            if (shouldKeepLocalChange(next, accountId)) return
            db.removeSong(next)
            songsByKey.remove(next.storageKey())
            favoriteTimes.remove(next.storageKey())
            refreshFlowLocked()
        }
    }

    /** 和本机变更共用 lock；检查 pending 后到数据库/内存发布之间不能插入新操作。 */
    private fun shouldKeepLocalChange(song: SongInfo, accountId: String): Boolean =
        syncOutbox.accountSnapshot() != accountId || syncOutbox.hasPending(
            accountId, SyncPayloads.TYPE_FAVORITE_SONG, SyncPayloads.songKey(song),
        )

    /** 账号首次 seed 与本机收藏操作共用锁，不能让旧快照的 UPSERT 排到 DELETE 后面。 */
    fun seedSyncOutbox(accountId: String) {
        ensureLoaded()
        synchronized(lock) {
            if (syncOutbox.accountSnapshot() != accountId) return
            for (song in songsByKey.values) {
                if (song.type == SongType.LOCAL || shouldKeepLocalChange(song, accountId)) continue
                syncOutbox.enqueue(
                    SyncPayloads.TYPE_FAVORITE_SONG, SyncPayloads.songKey(song),
                    SyncPayloads.ACTION_UPSERT, SyncPayloads.songPayload(song, favoriteTimes[song.storageKey()]),
                )
            }
        }
    }

    /** 完整快照结束后才执行缺失删除；每项与本机写入使用同一把锁。 */
    fun reconcileSnapshot(remoteKeys: Set<String>, initialSongs: List<SongInfo>, accountId: String) {
        ensureLoaded()
        synchronized(lock) {
            for (song in initialSongs) {
                if (song.type == SongType.LOCAL || SyncPayloads.songKey(song) in remoteKeys || shouldKeepLocalChange(song, accountId)) continue
                db.removeSong(song)
                songsByKey.remove(song.storageKey())
                favoriteTimes.remove(song.storageKey())
            }
            refreshFlowLocked()
        }
    }

    fun <T> withSyncBatch(action: () -> T): T = synchronized(lock) {
        syncBatchDepth++
        try { action() } finally {
            syncBatchDepth--
            refreshFlowLocked()
        }
    }

    fun <T> withDataLock(action: () -> T): T = synchronized(lock) { action() }

    fun clearLoveList() {
        ensureLoaded()
        synchronized(lock) {
            db.clearAll()
            songsByKey.clear()
            favoriteTimes.clear()
            latestFavoriteTime = 0L
            loveFile().takeIf { it.exists() }?.delete()
            refreshFlowLocked()
        }
    }

    private fun SongInfo.storageKey(): String = "${type.name}:$id"

    private companion object {
        private const val TAG = "LoveManager"
    }
}
