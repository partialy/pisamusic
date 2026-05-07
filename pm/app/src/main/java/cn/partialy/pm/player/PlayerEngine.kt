package cn.partialy.pm.player

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.view.KeyEvent
import android.widget.Toast
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import cn.partialy.pm.R
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.SettingsPrefs
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * 播放引擎：管理 ExoPlayer / MediaSession 生命周期、事件监听、进度追踪、
 * 播放模式切换、状态持久化，以及按需 URL 解析。
 *
 * [onNext] / [onPrevious] / [onTogglePlayPause] 由 MusicController 注入，
 * 用于 MediaSession 按钮回调（保证走统一入口）。
 */
@UnstableApi
class PlayerEngine(
    private val context: Context,
    private val playlistManager: PlaylistManager,
    private val factory: MediaItemFactory,
    private val onNext: () -> Unit,
    private val onPrevious: () -> Unit,
    private val onTogglePlayPause: () -> Unit,
) {
    var exoPlayer: ExoPlayer? = null
        private set
    var mediaSession: MediaSession? = null
        private set

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying = _isPlaying.asStateFlow()

    private val _progress = MutableStateFlow(0L)
    val progress = _progress.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration = _duration.asStateFlow()

    private val stateStore = PlayerStateStore(context)
    private var lastPersistAtMs = 0L
    private var restoreAttempted = false
    private var lastAutoSkipAtMs = 0L
    private val playbackRefreshRetryKeys = mutableSetOf<String>()

    /** 由 MusicController 在构造后调用 */
    fun init() {
        initPlayer()
        restoreIfPossible()
    }

    fun getStateStore(): PlayerStateStore = stateStore

    // ==================== ExoPlayer / MediaSession 初始化 ====================

    private fun initPlayer() {
        val mediaSourceFactory = DefaultMediaSourceFactory(
            PlayerCacheProvider.buildCacheDataSourceFactory(context)
        )
        exoPlayer = ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .setAudioAttributes(
                androidx.media3.common.AudioAttributes.Builder()
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .setUsage(C.USAGE_MEDIA)
                    .build(),
                true
            )
            .setHandleAudioBecomingNoisy(true)
            .build()
            .apply {
                applyPlayMode(SettingsPrefs.getPlayMode(context))
                addListener(playerListener)
            }

        playlistManager.exoPlayer = exoPlayer

        mediaSession = MediaSession.Builder(context, exoPlayer!!)
            .setId("MusicSession-${System.currentTimeMillis()}")
            .setCallback(sessionCallback)
            .build()
    }

    // ==================== Player.Listener ====================

    private val playerListener = object : Player.Listener {

        /**
         * 媒体项切换回调。
         * AUTO 切歌时优先消费插播队列：把队首歌曲插入当前位置并跳转播放。
         */
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            super.onMediaItemTransition(mediaItem, reason)
            val player = exoPlayer ?: return
            val newIndex = player.currentMediaItemIndex

            if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO
                && playlistManager.hasPlayNext()
            ) {
                val song = playlistManager.dequeuePlayNext()!!
                playlistManager.insertAtIndex(newIndex, song)
                player.seekTo(newIndex, 0)
                ensurePlayableAtIndex(newIndex, autoPlay = true)
                return
            }

            playlistManager.updateCurrentIndex(newIndex)
            when (reason) {
                Player.MEDIA_ITEM_TRANSITION_REASON_SEEK,
                Player.MEDIA_ITEM_TRANSITION_REASON_AUTO,
                Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT,
                -> ensurePlayableAtIndex(newIndex, autoPlay = true)
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _isPlaying.value = isPlaying
            if (isPlaying) startProgressUpdate()
        }

        override fun onPlayerError(error: PlaybackException) {
            super.onPlayerError(error)
            handlePlaybackFailureAndSkip()
        }

        @SuppressLint("SwitchIntDef")
        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_READY) {
                _isPlaying.value = exoPlayer?.isPlaying == true
                clearPlaybackRetryForCurrent()
            }
        }
    }

    // ==================== MediaSession.Callback ====================

    private val sessionCallback = object : MediaSession.Callback {

        override fun onMediaButtonEvent(
            session: MediaSession,
            controllerInfo: MediaSession.ControllerInfo,
            intent: Intent,
        ): Boolean {
            if (intent.action == Intent.ACTION_MEDIA_BUTTON) {
                val keyEvent = intent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)
                if (keyEvent?.action == KeyEvent.ACTION_DOWN) {
                    when (keyEvent.keyCode) {
                        KeyEvent.KEYCODE_MEDIA_NEXT -> onNext()
                        KeyEvent.KEYCODE_MEDIA_PREVIOUS -> onPrevious()
                        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> onTogglePlayPause()
                    }
                }
            }
            return super.onMediaButtonEvent(session, controllerInfo, intent)
        }

        @SuppressLint("WrongConstant")
        override fun onConnect(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
        ): MediaSession.ConnectionResult {
            val result = super.onConnect(session, controller)
            val cmds = result.availableSessionCommands.buildUpon()
                .add(Player.COMMAND_SEEK_TO_NEXT)
                .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                .add(Player.COMMAND_PLAY_PAUSE)
                .build()
            return MediaSession.ConnectionResult.accept(cmds, result.availablePlayerCommands)
        }

        override fun onSetMediaItems(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
            startIndex: Int,
            startPositionMs: Long,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> =
            Futures.immediateFuture(
                MediaSession.MediaItemsWithStartPosition(mediaItems, startIndex, startPositionMs)
            )
    }

    // ==================== 播放控制 ====================

    /** 下一曲：优先消费插播队列，其次走 shuffle / 顺序逻辑 */
    fun next() {
        val player = exoPlayer ?: return
        if (playlistManager.playList.value.isEmpty() || player.mediaItemCount == 0) return

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val queued = playlistManager.dequeuePlayNext()
                if (queued != null) {
                    val insertAt = player.currentMediaItemIndex + 1
                    playlistManager.insertAtIndex(insertAt, queued)
                    player.seekTo(insertAt, 0)
                    ensurePlayableAtIndex(insertAt, autoPlay = true)
                    return@launch
                }

                if (player.shuffleModeEnabled) {
                    player.seekToNext()
                    return@launch
                }

                val idx = player.currentMediaItemIndex
                val last = player.mediaItemCount - 1
                player.seekToDefaultPosition(if (idx >= last) 0 else idx + 1)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /** 上一曲 */
    fun previous() {
        val player = exoPlayer ?: return
        if (playlistManager.playList.value.isEmpty() || player.mediaItemCount == 0) return

        CoroutineScope(Dispatchers.Main).launch {
            try {
                if (player.shuffleModeEnabled) {
                    player.seekToPrevious()
                    return@launch
                }
                val idx = player.currentMediaItemIndex
                val last = player.mediaItemCount - 1
                player.seekToDefaultPosition(if (idx <= 0) last else idx - 1)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /** 播放/暂停切换 */
    fun togglePlayPause() {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                if (exoPlayer?.isPlaying == true) {
                    exoPlayer?.pause()
                } else {
                    ensurePlayableAtIndex(playlistManager.currentIndex.value, autoPlay = true)
                }
                persistState(force = true)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // ==================== 播放模式 ====================

    fun getPlayMode(): SettingsPrefs.PlayMode = SettingsPrefs.getPlayMode(context)

    fun togglePlayMode(): SettingsPrefs.PlayMode {
        val next = when (getPlayMode()) {
            SettingsPrefs.PlayMode.Order -> SettingsPrefs.PlayMode.Shuffle
            SettingsPrefs.PlayMode.Shuffle -> SettingsPrefs.PlayMode.Single
            SettingsPrefs.PlayMode.Single -> SettingsPrefs.PlayMode.Order
        }
        SettingsPrefs.setPlayMode(context, next)
        applyPlayMode(next)
        persistState(force = true)
        return next
    }

    fun applyPlayMode(mode: SettingsPrefs.PlayMode) {
        exoPlayer?.let { player ->
            when (mode) {
                SettingsPrefs.PlayMode.Order -> {
                    player.shuffleModeEnabled = false
                    player.repeatMode = Player.REPEAT_MODE_ALL
                }
                SettingsPrefs.PlayMode.Shuffle -> {
                    player.shuffleModeEnabled = true
                    player.repeatMode = Player.REPEAT_MODE_ALL
                }
                SettingsPrefs.PlayMode.Single -> {
                    player.shuffleModeEnabled = false
                    player.repeatMode = Player.REPEAT_MODE_ONE
                }
            }
        }
    }

    // ==================== 进度 ====================

    fun seekToProgress(progress: Int) {
        exoPlayer?.let { player ->
            player.seekTo((progress.toLong() * player.duration) / 100)
        }
    }

    fun seekToPositionMs(positionMs: Long) {
        exoPlayer?.let { player ->
            val d = player.duration
            val clamped =
                if (d > 0) positionMs.coerceIn(0L, d) else positionMs.coerceAtLeast(0L)
            player.seekTo(clamped)
        }
    }

    private fun startProgressUpdate() {
        CoroutineScope(Dispatchers.Main).launch {
            while (isActive) {
                exoPlayer?.let { player ->
                    _currentPosition.value = player.currentPosition
                    _duration.value = player.duration
                    _progress.value = if (player.duration > 0) {
                        (player.currentPosition * 100) / player.duration
                    } else 0
                    persistState(force = false)
                }
                delay(1000)
            }
        }
    }

    // ==================== 按需 URL 解析 ====================

    /** 如果指定位置仍是占位 MediaItem，异步获取真实 URL 并替换后播放 */
    fun ensurePlayableAtIndex(index: Int, autoPlay: Boolean) {
        CoroutineScope(Dispatchers.Main).launch {
            val song = playlistManager.playList.value.getOrNull(index) ?: return@launch
            val player = exoPlayer ?: return@launch
            if (index !in 0 until player.mediaItemCount) return@launch

            val currentItem = player.getMediaItemAt(index)
            if (!factory.isPlaceholderMediaItem(currentItem)) {
                if (autoPlay) {
                    if (player.currentMediaItemIndex != index) player.seekTo(index, 0)
                    player.prepare()
                    player.play()
                }
                return@launch
            }

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val resolved = factory.createMediaItem(song)
                    withContext(Dispatchers.Main) {
                        val p = exoPlayer ?: return@withContext
                        if (index !in 0 until p.mediaItemCount) return@withContext
                        p.replaceMediaItem(index, resolved)
                        p.seekTo(index, 0)
                        p.prepare()
                        if (autoPlay) p.play()
                        persistState(force = true)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    withContext(Dispatchers.Main) {
                        handlePlaybackFailureAndSkip()
                    }
                }
            }
        }
    }

    private fun handlePlaybackFailureAndSkip() {
        // 恢复态（pause + prepare）若触发 source error，不应自动切歌导致看起来“自动播放”。
        val player = exoPlayer ?: return
        if (player.playWhenReady != true) return
        val index = player.currentMediaItemIndex
        val song = playlistManager.playList.value.getOrNull(index)
        if (song != null && shouldRetryWithFreshUrl(song)) {
            retryCurrentSongWithFreshUrl(
                index = index,
                song = song,
                positionMs = player.currentPosition.coerceAtLeast(0L),
            )
            return
        }
        autoSkipAfterPlaybackFailure()
    }

    private fun shouldRetryWithFreshUrl(song: SongInfo): Boolean {
        if (song.type == SongType.LOCAL) return false
        return playbackRefreshRetryKeys.add(factory.keyOf(song))
    }

    private fun retryCurrentSongWithFreshUrl(index: Int, song: SongInfo, positionMs: Long) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                factory.invalidateCachedPlayableUrl(song)
                val resolved = factory.createMediaItem(song, forceRefreshUrl = true)
                withContext(Dispatchers.Main) {
                    val player = exoPlayer ?: return@withContext
                    val currentSong = playlistManager.playList.value.getOrNull(index)
                    if (currentSong == null || factory.keyOf(currentSong) != factory.keyOf(song)) {
                        return@withContext
                    }
                    if (index !in 0 until player.mediaItemCount) return@withContext
                    player.replaceMediaItem(index, resolved)
                    player.seekTo(index, positionMs)
                    player.prepare()
                    player.play()
                    persistState(force = true)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                withContext(Dispatchers.Main) {
                    autoSkipAfterPlaybackFailure()
                }
            }
        }
    }

    private fun autoSkipAfterPlaybackFailure() {
        val now = System.currentTimeMillis()
        if (now - lastAutoSkipAtMs < 1200L) return
        lastAutoSkipAtMs = now

        Toast.makeText(context, context.getString(R.string.play_url_failed_skip_next), Toast.LENGTH_SHORT).show()
        onNext()
    }

    private fun clearPlaybackRetryForCurrent() {
        val player = exoPlayer ?: return
        val song = playlistManager.playList.value.getOrNull(player.currentMediaItemIndex) ?: return
        playbackRefreshRetryKeys.remove(factory.keyOf(song))
    }

    // ==================== 状态持久化 ====================

    /** 持久化当前播放状态；非 force 时每 5 秒写一次，避免频繁 IO */
    fun persistState(force: Boolean) {
        val now = System.currentTimeMillis()
        if (!force && now - lastPersistAtMs < 5_000) return
        val songs = playlistManager.playList.value
        if (songs.isEmpty()) return
        val idx = playlistManager.currentIndex.value.coerceIn(0, (songs.size - 1).coerceAtLeast(0))
        val position = exoPlayer?.currentPosition ?: _currentPosition.value
        val dur = exoPlayer?.duration ?: _duration.value
        val playing = exoPlayer?.playWhenReady == true &&
                (exoPlayer?.isPlaying == true || exoPlayer?.playbackState == Player.STATE_READY)
        stateStore.save(
            PersistedPlayerState(
                songs = songs.map { it.toPersistedSong() },
                currentIndex = idx,
                currentSongUrl = null,
                positionMs = position,
                durationMs = dur,
                playWhenReady = playing,
            )
        )
        lastPersistAtMs = now
    }

    /** 启动时恢复上次播放状态（占位恢复，不自动播放） */
    private fun restoreIfPossible() {
        if (restoreAttempted) return
        restoreAttempted = true
        CoroutineScope(Dispatchers.IO).launch {
            val state = stateStore.load() ?: return@launch
            if (state.songs.isEmpty()) return@launch
            val songs = state.songs.map { it.toSongInfo() }
            val idx = state.currentIndex.coerceIn(0, (songs.size - 1).coerceAtLeast(0))
            val pos = state.positionMs.coerceAtLeast(0L)
            try {
                // 先恢复列表，再尝试解析「当前歌曲」URL；失败则依次尝试后续歌曲作为新的当前项。
                val resolved = resolveRestoredCurrent(songs, idx)
                withContext(Dispatchers.Main) {
                    playlistManager.restoreState(songs, resolved.index)
                    exoPlayer?.apply {
                        clearMediaItems()
                        setMediaItems(
                            songs.map { factory.createPlaceholderMediaItem(it) },
                            resolved.index,
                            if (resolved.index == idx) pos else 0L,
                        )
                        replaceMediaItem(resolved.index, resolved.item)
                        seekTo(resolved.index, if (resolved.index == idx) pos else 0L)
                        applyPlayMode(SettingsPrefs.getPlayMode(context))
                        prepare()
                        pause()
                    }
                }
            } catch (_: Exception) {
                // ignore restore failure
            }
        }
    }

    private data class ResolvedRestoreTarget(
        val index: Int,
        val item: MediaItem,
    )

    private suspend fun resolveRestoredCurrent(
        songs: List<SongInfo>,
        startIndex: Int,
    ): ResolvedRestoreTarget {
        val currentSong = songs[startIndex]
        val total = songs.size
        for (offset in 0 until total) {
            val index = (startIndex + offset) % total
            val song = songs[index]
            runCatching { factory.createMediaItem(song) }
                .onSuccess { return ResolvedRestoreTarget(index, it) }
        }
        return ResolvedRestoreTarget(startIndex, factory.createPlaceholderMediaItem(currentSong))
    }

    /** 释放 ExoPlayer 和 MediaSession */
    fun release() {
        mediaSession?.release()
        mediaSession = null
        exoPlayer?.release()
        exoPlayer = null
        PlayerCacheProvider.release()
    }
}
