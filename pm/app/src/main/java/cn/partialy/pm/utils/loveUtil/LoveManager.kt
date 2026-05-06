package cn.partialy.pm.utils.loveUtil

import android.content.Context
import android.util.Log
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
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
    private val lock = Any()
    private var loaded = false
    private val songsById = LinkedHashMap<String, SongInfo>()

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
            val list = readListFromDisk()
            songsById.clear()
            for (s in list) songsById[s.id] = s
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
        _loveListFlow.value = songsById.values.toList()
    }

    fun getLoveList(): List<SongInfo> {
        ensureLoaded()
        synchronized(lock) {
            return songsById.values.toList()
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
            songsById.values.map { it.forPersistence() }
        }
        scope.launch {
            persistMutex.withLock {
                try {
                    val file = loveFile()
                    file.parentFile?.mkdirs()
                    file.writeText(gson.toJson(snapshot))
                } catch (e: Exception) {
                    Log.e(TAG, "save love list failed", e)
                }
            }
        }
    }

    fun toggleLikeStatus(songInfo: SongInfo) {
        if (isSongInLoveList(songInfo)) {
            removeSongFromLoveList(listOf(songInfo.id))
        } else {
            addSongToLoveList(songInfo)
        }
    }

    fun isSongInLoveList(songInfo: SongInfo): Boolean {
        ensureLoaded()
        synchronized(lock) {
            return songsById.containsKey(songInfo.id)
        }
    }

    private fun addSongToLoveList(song: SongInfo) {
        ensureLoaded()
        var added = false
        synchronized(lock) {
            if (!songsById.containsKey(song.id)) {
                songsById[song.id] = song
                refreshFlowLocked()
                added = true
            }
        }
        if (added) persistAsync()
    }

    private fun removeSongFromLoveList(songIds: List<String>) {
        ensureLoaded()
        var changed = false
        synchronized(lock) {
            for (id in songIds) {
                if (songsById.remove(id) != null) changed = true
            }
            if (changed) refreshFlowLocked()
        }
        if (changed) persistAsync()
    }

    fun clearLoveList() {
        ensureLoaded()
        val hadAny = synchronized(lock) {
            if (songsById.isEmpty()) return
            songsById.clear()
            refreshFlowLocked()
            true
        }
        if (hadAny) persistAsync()
    }

    private companion object {
        private const val TAG = "LoveManager"
    }
}
