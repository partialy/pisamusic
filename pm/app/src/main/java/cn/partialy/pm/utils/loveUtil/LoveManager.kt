package cn.partialy.pm.utils.loveUtil

import android.content.Context
import android.util.Log
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
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
            gson.fromJson(content, Array<SongInfo>::class.java).toList()
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
                songsByKey[song.storageKey()] = song.forPersistence()
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

    fun upsertFromSync(song: cn.partialy.pm.model.CanonicalSong) {
        val next = song.toSongInfo().forPersistence()
        if (next.type == SongType.LOCAL || next.id.isBlank()) return
        ensureLoaded()
        db.addSong(next)
        synchronized(lock) {
            songsByKey[next.storageKey()] = next
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
