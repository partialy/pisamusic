package cn.partialy.pm.player

import androidx.media3.common.util.UnstableApi
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

sealed interface PlaylistSetResult {
    data class Applied(val songs: List<SongInfo>, val startIndex: Int) : PlaylistSetResult
    data object SameSource : PlaylistSetResult
    data object Failed : PlaylistSetResult
    data object Stale : PlaylistSetResult
}

/**
 * 播放列表管理器：维护列表状态、插播队列（FIFO），同步 ExoPlayer 逻辑 MediaItem。
 */
@UnstableApi
class PlaylistManager(private val factory: MediaItemFactory) {

    private val preparationScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val preparationGate = PlaylistPreparationGate()
    private val restoreGate = PlaylistPreparationGate()
    private val preparationMutex = Mutex()

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

    /** 插播队列内部存储（FIFO），同一音源的同一首歌只保留一次 */
    private val playNextQueueInternal = ArrayDeque<SongInfo>()
    private val _playNextQueue = MutableStateFlow<List<SongInfo>>(emptyList())
    val playNextQueue = _playNextQueue.asStateFlow()
    private val preparedPlayNextItems = mutableMapOf<String, MediaItem>()

    // ==================== 插播队列 ====================

    /**
     * 添加到插播队列尾部（FIFO）。
     * 重复点击同一首歌不会重复入队；若歌曲不在主列表则追加可直接播放的逻辑项到主列表尾部。
     */
    fun addPlayNext(song: SongInfo) {
        if (!song.playable) return
        restoreGate.invalidate()
        val generation = preparationGate.current()
        preparationScope.launch {
            preparationMutex.withLock {
                val mediaItem = withContext(Dispatchers.IO) {
                    runCatching { factory.createQueueMediaItem(song) }.getOrNull()
                } ?: return@withLock
                if (!preparationGate.isCurrent(generation)) return@withLock

                val updatedQueue = enqueueUniqueBy(
                    items = playNextQueueInternal.toList(),
                    item = song,
                    keyOf = ::songIdentityKey,
                )
                if (updatedQueue.size == playNextQueueInternal.size) return@withLock
                playNextQueueInternal.clear()
                playNextQueueInternal.addAll(updatedQueue)
                _playNextQueue.value = updatedQueue

                val songKey = factory.keyOf(song)
                preparedPlayNextItems[songKey] = mediaItem
                val player = exoPlayer ?: return@withLock
                val exists = _playList.value.any { factory.keyOf(it) == factory.keyOf(song) }
                if (!exists) {
                    _playList.value = _playList.value + song
                    player.addMediaItem(mediaItem)
                }
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
     * 设置播放列表（在线歌曲只登记逻辑 URI，不提前取链）。
     * 同源检测：若 [newSourceId] 与当前 sourceId 一致，通过 [onResult] 返回 [PlaylistSetResult.SameSource]。
     * 否则按 type+id 去重，清空插播队列，从 [startIndex] 开始播放。
     */
    fun setPlayListLazy(
        songs: List<SongInfo>,
        startIndex: Int = 0,
        newSourceId: String? = null,
        onResult: (PlaylistSetResult) -> Unit = {},
    ) {
        restoreGate.invalidate()
        val generation = preparationGate.nextReplacement()
        val playableSongs = songs.filter(SongInfo::playable)
        if (playableSongs.isEmpty()) {
            onResult(PlaylistSetResult.Failed)
            return
        }
        if (newSourceId != null && newSourceId == _sourceId) {
            onResult(PlaylistSetResult.SameSource)
            return
        }

        val deduped = LinkedHashMap<String, SongInfo>(playableSongs.size)
        for (s in playableSongs) deduped[factory.keyOf(s)] = s
        val list = deduped.values.toList()
        if (list.isEmpty()) {
            onResult(PlaylistSetResult.Failed)
            return
        }

        val idx = startIndex.coerceIn(0, list.size - 1)
        preparationScope.launch {
            preparationMutex.withLock {
                val mediaItems = withContext(Dispatchers.IO) {
                    prepareAllOrNullSuspending(list, factory::createQueueMediaItem)
                }
                if (!preparationGate.isCurrent(generation)) {
                    onResult(PlaylistSetResult.Stale)
                    return@withLock
                }
                if (mediaItems == null) {
                    onResult(PlaylistSetResult.Failed)
                    return@withLock
                }

                _sourceId = newSourceId
                _playList.value = list
                _currentIndex.value = idx
                _currentSong.value = list[idx]
                playNextQueueInternal.clear()
                preparedPlayNextItems.clear()
                _playNextQueue.value = emptyList()

                exoPlayer?.apply {
                    clearMediaItems()
                    setMediaItems(mediaItems, idx, 0)
                    if (list[idx].type != SongType.CLOUD) prepare()
                }
                onResult(PlaylistSetResult.Applied(list, idx))
            }
        }
    }

    /** 追加歌曲到列表尾部（在线歌曲为逻辑项，按 key 去重已有的跳过） */
    fun appendSongsLazy(
        songs: List<SongInfo>,
        onApplied: (Boolean) -> Unit = {},
    ) {
        restoreGate.invalidate()
        val playableSongs = songs.filter(SongInfo::playable)
        if (playableSongs.isEmpty()) {
            onApplied(false)
            return
        }
        val generation = preparationGate.current()
        preparationScope.launch {
            preparationMutex.withLock {
                val player = exoPlayer ?: return@withLock
                val existingKeys = _playList.value.mapTo(HashSet()) { factory.keyOf(it) }
                val toAdd = ArrayList<SongInfo>(playableSongs.size)
                for (s in playableSongs) {
                    if (existingKeys.add(factory.keyOf(s))) toAdd.add(s)
                }
                if (toAdd.isEmpty()) {
                    onApplied(false)
                    return@withLock
                }
                val mediaItems = withContext(Dispatchers.IO) {
                    prepareAllOrNullSuspending(toAdd, factory::createQueueMediaItem)
                }
                if (mediaItems == null || !preparationGate.isCurrent(generation)) {
                    onApplied(false)
                    return@withLock
                }

                val currentKeys = _playList.value.mapTo(HashSet()) { factory.keyOf(it) }
                val stillNewIndices = toAdd.indices.filter { currentKeys.add(factory.keyOf(toAdd[it])) }
                if (stillNewIndices.isEmpty()) {
                    onApplied(false)
                    return@withLock
                }
                _playList.value = _playList.value + stillNewIndices.map(toAdd::get)
                player.addMediaItems(stillNewIndices.map(mediaItems::get))
                onApplied(true)
            }
        }
    }

    /**
     * Resolve first, then atomically apply the song on the main thread.
     * [isLatest] prevents a late URL response from an older request replacing a newer song.
     */
    suspend fun playSingleLatest(
        song: SongInfo,
        autoPlay: Boolean,
        isLatest: () -> Boolean,
    ): Boolean {
        if (!song.playable) return false
        restoreGate.invalidate()
        val generation = preparationGate.nextReplacement()
        val mediaItem = withContext(Dispatchers.IO) {
            factory.createMediaItem(song)
        }
        return withContext(Dispatchers.Main.immediate) {
            if (!isLatest() || !preparationGate.isCurrent(generation)) return@withContext false
            val player = exoPlayer ?: return@withContext false
            var index = _playList.value.indexOfFirst {
                it.type == song.type && it.id == song.id
            }
            if (index < 0) {
                _sourceId = "list_updated"
                val newList = _playList.value + song
                _playList.value = newList
                index = newList.lastIndex
                player.addMediaItem(mediaItem)
            } else {
                if (index !in 0 until player.mediaItemCount) return@withContext false
                player.replaceMediaItem(index, mediaItem)
            }
            if (!isLatest()) return@withContext false
            if (!autoPlay) player.pause()
            _currentIndex.value = index
            _currentSong.value = song
            player.seekTo(index, 0L)
            player.prepare()
            if (autoPlay) player.play() else player.pause()
            true
        }
    }

    /** 从列表移除歌曲，同步 ExoPlayer 并修正索引 */
    fun removeFromPlayList(song: SongInfo) {
        restoreGate.invalidate()
        preparationGate.invalidate()
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
        restoreGate.invalidate()
        preparationGate.invalidate()
        _sourceId = null
        _playList.value = emptyList()
        _currentIndex.value = 0
        _currentSong.value = null
        playNextQueueInternal.clear()
        preparedPlayNextItems.clear()
        _playNextQueue.value = emptyList()
        exoPlayer?.clearMediaItems()
        exoPlayer?.stop()
        stateStore.clear()
    }

    /** 把插播歌曲移动或插入指定位置，并保持业务列表与 ExoPlayer 列表一致。 */
    fun placePlayNextAt(index: Int, song: SongInfo): Int {
        if (!song.playable) return exoPlayer?.currentMediaItemIndex?.coerceAtLeast(0) ?: 0
        val placement = planPlayNextPlacement(
            songs = _playList.value,
            requestedIndex = index,
            song = song,
            keyOf = factory::keyOf,
        )
        val player = exoPlayer
        val previousIndex = placement.previousIndex
        val preparedItem = if (previousIndex == null) {
            preparedPlayNextItems.remove(factory.keyOf(song))
        } else {
            preparedPlayNextItems.remove(factory.keyOf(song))
            null
        }
        if (player != null && previousIndex == null && preparedItem == null) {
            return player.currentMediaItemIndex.coerceAtLeast(0)
        }

        _sourceId = "list_updated"
        _playList.value = placement.songs
        when {
            player == null -> Unit
            previousIndex == null -> player.addMediaItem(
                placement.targetIndex,
                requireNotNull(preparedItem),
            )
            previousIndex != placement.targetIndex -> player.moveMediaItem(
                previousIndex,
                placement.targetIndex,
            )
        }
        return placement.targetIndex
    }

    /** 更新当前播放索引和对应歌曲信息 */
    fun updateCurrentIndex(index: Int) {
        _currentIndex.value = index
        _currentSong.value = _playList.value.getOrNull(index)
    }

    fun beginRestorePreparation(): Long = restoreGate.nextReplacement()

    /** 仅当前恢复请求可以提交已在 IO 完整构造的列表。 */
    fun restorePreparedState(
        generation: Long,
        songs: List<SongInfo>,
        index: Int,
    ): Boolean {
        if (!restoreGate.isCurrent(generation)) return false
        _playList.value = songs
        _currentIndex.value = index
        _currentSong.value = songs.getOrNull(index)
        return true
    }

    fun release() {
        restoreGate.invalidate()
        preparationGate.invalidate()
        preparationScope.cancel()
    }
}
