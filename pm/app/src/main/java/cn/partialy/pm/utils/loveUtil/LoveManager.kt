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
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
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
    private val songsByKey = LinkedHashMap<String, SongInfo>()

    private val _loveListFlow = MutableStateFlow<List<SongInfo>>(emptyList())
    val loveListFlow: StateFlow<List<SongInfo>> = _loveListFlow.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val persistMutex = Mutex()

    private fun loveFile(): File = File(context.filesDir, fileName)

    private fun readListFromDisk(): List<SongInfo> {
        return try {
            val file = loveFile()
            if (!file.exists()) return emptyList()
            val content = file.readText()
            if (content.isBlank()) return emptyList()
            gson.decodeSongInfoListCompat(content)
        } catch (e: Exception) {
            Log.e(TAG, "read love list failed", e)
            emptyList()
        }
    }

    private fun ensureLoaded() {
        synchronized(lock) {
            if (loaded) return
            db.mergeLegacySongs(readListFromDisk().map { it.forPersistence() })
            val list = db.getSongs()
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

    private fun refreshFlowLocked() {
        _loveListFlow.value = songsByKey.values.toList()
    }

    /** 收藏默认按添加时间倒序展示，新收藏应立即进入列表首位。 */
    private fun putNewestFirstLocked(song: SongInfo) {
        val key = song.storageKey()
        val reordered = LinkedHashMap<String, SongInfo>(songsByKey.size + 1)
        reordered[key] = song
        songsByKey.forEach { (existingKey, existingSong) ->
            if (existingKey != key) reordered[existingKey] = existingSong
        }
        songsByKey.clear()
        songsByKey.putAll(reordered)
    }

    fun getLoveList(): List<SongInfo> {
        ensureLoaded()
        synchronized(lock) {
            return songsByKey.values.toList()
        }
    }

    /** Strip embedded cover bytes for LOCAL tracks before JSON (avoids huge base64 in file). */
    private fun SongInfo.forPersistence(): SongInfo {
        if (type != SongType.LOCAL) return this
        if (embeddedCoverArt == null) return this
        return copy(embeddedCoverArt = null)
    }

    private fun persistAsync() {
        val snapshot = synchronized(lock) {
            songsByKey.values.map { it.forPersistence() }
        }
        scope.launch {
            persistMutex.withLock {
                writeLegacyMirror(snapshot)
            }
        }
    }

    fun syncLegacyMirrorNow() {
        ensureLoaded()
        val snapshot = synchronized(lock) {
            songsByKey.values.map { it.forPersistence() }
        }
        writeLegacyMirror(snapshot)
    }

    private fun writeLegacyMirror(snapshot: List<SongInfo>) {
        try {
            val file = loveFile()
            file.parentFile?.mkdirs()
            file.writeText(gson.toJson(snapshot))
        } catch (e: Exception) {
            Log.e(TAG, "save love list failed", e)
        }
    }

    fun mergeLegacySongs(songs: List<SongInfo>): Int {
        val added = db.mergeLegacySongs(songs.map { it.forPersistence() })
        reload()
        persistAsync()
        return added
    }

    fun toggleLikeStatus(songInfo: SongInfo): Boolean {
        return if (isSongInLoveList(songInfo)) {
            removeSongFromLoveList(songInfo)
            false
        } else {
            addSongToLoveList(songInfo)
            true
        }
    }

    fun isSongInLoveList(songInfo: SongInfo): Boolean {
        ensureLoaded()
        synchronized(lock) {
            return songsByKey.containsKey(songInfo.storageKey())
        }
    }

    private fun addSongToLoveList(song: SongInfo) {
        ensureLoaded()
        val persisted = db.addSong(song.forPersistence())
        if (!persisted) return
        synchronized(lock) {
            if (!songsByKey.containsKey(song.storageKey())) {
                putNewestFirstLocked(song.forPersistence())
                refreshFlowLocked()
            }
        }
        enqueueFavoriteSong(song, SyncPayloads.ACTION_UPSERT)
        persistAsync()
    }

    private fun removeSongFromLoveList(song: SongInfo) {
        ensureLoaded()
        val changed = db.removeSong(song)
        if (!changed) return
        synchronized(lock) {
            songsByKey.remove(song.storageKey())
            refreshFlowLocked()
        }
        enqueueFavoriteSong(song, SyncPayloads.ACTION_DELETE)
        persistAsync()
    }

    fun removeSongsFromLoveList(songs: Collection<SongInfo>): Int {
        if (songs.isEmpty()) return 0
        ensureLoaded()
        var removedCount = 0
        val removedSongs = mutableListOf<SongInfo>()
        synchronized(lock) {
            for (song in songs) {
                if (db.removeSong(song)) {
                    songsByKey.remove(song.storageKey())
                    removedSongs.add(song)
                    removedCount++
                }
            }
            if (removedCount > 0) {
                refreshFlowLocked()
            }
        }
        if (removedCount > 0) {
            for (song in removedSongs) {
                enqueueFavoriteSong(song, SyncPayloads.ACTION_DELETE)
            }
            persistAsync()
        }
        return removedCount
    }

    data class BatchAddResult(
        val added: List<SongInfo>,
        val existing: List<SongInfo>,
        val failed: List<SongInfo>,
    )

    /** 幂等添加；只为新增项写同步事件，集中刷新列表与备份镜像。 */
    fun addSongsToLoveList(songs: Collection<SongInfo>): BatchAddResult {
        ensureLoaded()
        val added = mutableListOf<SongInfo>()
        val existing = mutableListOf<SongInfo>()
        val failed = mutableListOf<SongInfo>()
        synchronized(lock) {
            for (song in songs.distinctBy { it.storageKey() }) {
                if (song.id.isBlank()) {
                    failed.add(song)
                    continue
                }
                try {
                    if (songsByKey.containsKey(song.storageKey())) {
                        existing.add(song)
                    } else if (db.addSong(song.forPersistence())) {
                        putNewestFirstLocked(song.forPersistence())
                        added.add(song)
                    } else if (db.contains(song)) {
                        songsByKey[song.storageKey()] = song.forPersistence()
                        existing.add(song)
                    } else failed.add(song)
                } catch (_: Exception) {
                    failed.add(song)
                }
            }
            refreshFlowLocked()
        }
        for (song in added) enqueueFavoriteSong(song, SyncPayloads.ACTION_UPSERT)
        if (added.isNotEmpty()) persistAsync()
        return BatchAddResult(added, existing, failed)
    }

    fun upsertFromSync(song: cn.partialy.pm.model.CanonicalSong) {
        val next = song.toSongInfo().forPersistence()
        if (next.type == SongType.LOCAL || next.id.isBlank()) return
        ensureLoaded()
        val inserted = db.addSong(next)
        synchronized(lock) {
            if (inserted) {
                putNewestFirstLocked(next)
            } else {
                songsByKey[next.storageKey()] = next
            }
            refreshFlowLocked()
        }
        persistAsync()
    }

    fun removeFromSync(song: cn.partialy.pm.model.CanonicalSong) {
        val next = song.toSongInfo()
        if (next.id.isBlank()) return
        ensureLoaded()
        db.removeSong(next)
        synchronized(lock) {
            songsByKey.remove(next.storageKey())
            refreshFlowLocked()
        }
        persistAsync()
    }

    fun clearLoveList() {
        ensureLoaded()
        val hadAny = synchronized(lock) {
            if (songsByKey.isEmpty()) return
            songsByKey.clear()
            refreshFlowLocked()
            true
        }
        if (hadAny) {
            db.clearAll()
            persistAsync()
        }
    }

    private fun SongInfo.storageKey(): String = "${type.name}:$id"

    private fun enqueueFavoriteSong(song: SongInfo, action: String) {
        if (song.type == SongType.LOCAL) return
        syncOutbox.enqueue(
            itemType = SyncPayloads.TYPE_FAVORITE_SONG,
            itemKey = SyncPayloads.songKey(song),
            action = action,
            payloadJson = if (action == SyncPayloads.ACTION_DELETE) "{}" else SyncPayloads.songPayload(song),
        )
        SyncWorkRunner.request(context)
    }

    private companion object {
        private const val TAG = "LoveManager"
    }
}
