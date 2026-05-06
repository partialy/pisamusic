package cn.partialy.pm.player

import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import cn.partialy.pm.model.SongInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * 播放列表管理器：维护列表状态、插播队列（FIFO），同步 ExoPlayer MediaItem。
 */
@UnstableApi
class PlaylistManager(private val factory: MediaItemFactory) {

    /** 由 PlayerEngine 初始化后注入 */
    var exoPlayer: ExoPlayer? = null

    private val _playList = MutableStateFlow<List<SongInfo>>(emptyList())
    val playList = _playList.asStateFlow()

    private val _currentIndex = MutableStateFlow(0)
    val currentIndex = _currentIndex.asStateFlow()

    private val _currentSong = MutableStateFlow<SongInfo?>(null)
    val currentSong = _currentSong.asStateFlow()

    /** 当前播放列表的来源标识，用于同源检测避免重复替换 */
    private var _sourceId: String? = null
    val sourceId: String? get() = _sourceId

    /** 插播队列内部存储（FIFO），允许同一首歌重复入队 */
    private val playNextQueueInternal = ArrayDeque<SongInfo>()
    private val _playNextQueue = MutableStateFlow<List<SongInfo>>(emptyList())
    val playNextQueue = _playNextQueue.asStateFlow()

    // ==================== 插播队列 ====================

    /**
     * 添加到插播队列尾部（FIFO）。
     * 队列内允许重复；若歌曲不在主列表则同时追加一份占位项到主列表尾部。
     */
    fun addPlayNext(song: SongInfo) {
        CoroutineScope(Dispatchers.Main).launch {
            playNextQueueInternal.addLast(song)
            _playNextQueue.value = playNextQueueInternal.toList()

            val player = exoPlayer ?: return@launch
            val exists = _playList.value.any { factory.keyOf(it) == factory.keyOf(song) }
            if (!exists) {
                _playList.value = _playList.value + song
                player.addMediaItem(factory.createPlaceholderMediaItem(song))
            }
        }
    }

    /** 从队列头部取出一首；队列为空返回 null */
    fun dequeuePlayNext(): SongInfo? {
        if (playNextQueueInternal.isEmpty()) return null
        val song = playNextQueueInternal.removeFirst()
        _playNextQueue.value = playNextQueueInternal.toList()
        return song
    }

    fun hasPlayNext(): Boolean = playNextQueueInternal.isNotEmpty()

    // ==================== 列表操作 ====================

    /**
     * 设置播放列表（占位加载）。
     * 同源检测：若 [newSourceId] 与当前 sourceId 一致，返回 null 表示无需替换。
     * 否则按 type+id 去重，清空插播队列，从 [startIndex] 开始播放。
     */
    fun setPlayListLazy(
        songs: List<SongInfo>,
        startIndex: Int = 0,
        newSourceId: String? = null,
    ): List<SongInfo>? {
        if (songs.isEmpty()) return null
        if (newSourceId != null && newSourceId == _sourceId) return null

        val deduped = LinkedHashMap<String, SongInfo>(songs.size)
        for (s in songs) deduped[factory.keyOf(s)] = s
        val list = deduped.values.toList()
        if (list.isEmpty()) return null

        val idx = startIndex.coerceIn(0, list.size - 1)
        _sourceId = newSourceId
        _playList.value = list
        _currentIndex.value = idx
        _currentSong.value = list[idx]
        playNextQueueInternal.clear()
        _playNextQueue.value = emptyList()

        exoPlayer?.apply {
            clearMediaItems()
            setMediaItems(list.map { factory.createPlaceholderMediaItem(it) }, idx, 0)
            prepare()
        }
        return list
    }

    /** 追加歌曲到列表尾部（占位，按 key 去重已有的跳过） */
    fun appendSongsLazy(songs: List<SongInfo>) {
        if (songs.isEmpty()) return
        CoroutineScope(Dispatchers.Main).launch {
            val player = exoPlayer ?: return@launch
            val existingKeys = _playList.value.mapTo(HashSet()) { factory.keyOf(it) }
            val toAdd = ArrayList<SongInfo>(songs.size)
            for (s in songs) {
                if (existingKeys.add(factory.keyOf(s))) toAdd.add(s)
            }
            if (toAdd.isEmpty()) return@launch
            _playList.value = _playList.value + toAdd
            for (s in toAdd) player.addMediaItem(factory.createPlaceholderMediaItem(s))
        }
    }

    /**
     * 播放单曲：已在列表则跳转播放，否则追加到尾部并播放。
     * [onEnsurePlayable] 回调让 engine 按需解析 URL。
     */
    fun playSingle(song: SongInfo, onEnsurePlayable: (Int) -> Unit) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                _currentSong.value = song
                val index = _playList.value.indexOfFirst {
                    it.type == song.type && it.id == song.id
                }
                if (index != -1) {
                    withContext(Dispatchers.Main) {
                        _currentIndex.value = index
                        exoPlayer?.seekTo(index, 0)
                        onEnsurePlayable(index)
                    }
                } else {
                    val mediaItem = factory.createMediaItem(song)
                    withContext(Dispatchers.Main) {
                        _sourceId = "list_updated"
                        val newList = _playList.value.toMutableList().apply { add(song) }
                        _playList.value = newList
                        val newIdx = newList.size - 1
                        _currentIndex.value = newIdx
                        exoPlayer?.apply {
                            addMediaItem(mediaItem)
                            seekTo(newIdx, 0)
                            prepare()
                            play()
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /** 从列表移除歌曲，同步 ExoPlayer 并修正索引 */
    fun removeFromPlayList(song: SongInfo) {
        val list = _playList.value.toMutableList()
        val index = list.indexOf(song)
        if (index == -1) return

        _sourceId = "list_updated"
        list.removeAt(index)
        _playList.value = list
        exoPlayer?.removeMediaItem(index)

        when {
            list.isEmpty() -> {
                _currentSong.value = null
                _currentIndex.value = 0
                exoPlayer?.stop()
            }
            index == _currentIndex.value -> {
                _currentIndex.value = index.coerceAtMost(list.size - 1)
                _currentSong.value = list.getOrNull(_currentIndex.value)
                exoPlayer?.seekTo(_currentIndex.value, 0)
            }
            index < _currentIndex.value -> {
                _currentIndex.value--
            }
        }
    }

    /** 清空列表和插播队列 */
    fun clearPlayList(stateStore: PlayerStateStore) {
        _sourceId = null
        _playList.value = emptyList()
        _currentIndex.value = 0
        _currentSong.value = null
        playNextQueueInternal.clear()
        _playNextQueue.value = emptyList()
        exoPlayer?.clearMediaItems()
        exoPlayer?.stop()
        stateStore.clear()
    }

    /** 在指定位置插入歌曲（同步 ExoPlayer MediaItem） */
    fun insertAtIndex(index: Int, song: SongInfo) {
        val list = _playList.value.toMutableList()
        list.add(index, song)
        _playList.value = list
        exoPlayer?.addMediaItem(index, factory.createPlaceholderMediaItem(song))
    }

    /** 更新当前播放索引和对应歌曲信息 */
    fun updateCurrentIndex(index: Int) {
        _currentIndex.value = index
        _currentSong.value = _playList.value.getOrNull(index)
    }

    /** 恢复持久化状态（不触发播放，仅设置列表和索引） */
    fun restoreState(songs: List<SongInfo>, index: Int) {
        _playList.value = songs
        _currentIndex.value = index
        _currentSong.value = songs.getOrNull(index)
    }
}
