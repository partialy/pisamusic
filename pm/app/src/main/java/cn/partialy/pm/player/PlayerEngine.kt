package cn.partialy.pm.player

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.util.Log
import android.view.KeyEvent
import androidx.media3.common.C
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionResult
import cn.partialy.pm.audioeffect.AudioEffectsRenderersFactory
import cn.partialy.pm.audioeffect.AudioEffectsManager
import cn.partialy.pm.model.DownloadQualityChoice
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.toPlaybackQualityKey
import cn.partialy.pm.player.cache.PlaybackMediaCache
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.fault.PlaybackFaultRecorder
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
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
    private val fallbackProvider: PlaybackFallbackProvider,
    private val playbackMediaCache: PlaybackMediaCache,
    private val playbackFaultRecorder: PlaybackFaultRecorder,
    private val audioEffectsManager: AudioEffectsManager,
    private val onNext: () -> Unit,
    private val onPrevious: () -> Unit,
    private val onTogglePlayPause: () -> Unit,
    private val onPlaybackEvent: (PlaybackUiEvent) -> Unit,
    private val onPlayerChanged: (ExoPlayer) -> Unit,
) {
    var exoPlayer: ExoPlayer? = null
        private set
    var mediaSession: MediaSession? = null
        private set

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying = _isPlaying.asStateFlow()
    private val _playbackState = MutableStateFlow(Player.STATE_IDLE)
    val playbackState = _playbackState.asStateFlow()

    private val _progress = MutableStateFlow(0L)
    val progress = _progress.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration = _duration.asStateFlow()

    private val stateStore = PlayerStateStore(context)
    private var lastPersistAtMs = 0L
    private var restoreAttempted = false
    private var lastFailurePauseAtMs = 0L
    private var lastManualNextAtMs = 0L
    private var lastManualPreviousAtMs = 0L
    private var progressUpdateJob: Job? = null
    private var audioRendererStateJob: Job? = null
    private var released = false
    private var usingAudioEffectsRenderer = false
    private var audioEffectsRendererDisabledForSession = false
    private val audioRendererRetryKeys = mutableSetOf<String>()
    private val cacheSyncJob = SupervisorJob()
    private val cacheSyncScope = CoroutineScope(cacheSyncJob + Dispatchers.IO)
    private val playbackAudioAttributes = AudioAttributes.Builder()
        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
        .setUsage(C.USAGE_MEDIA)
        .build()
    private val audioCoexistenceController = AudioCoexistenceController(
        context = context,
        isPlaybackActive = {
            exoPlayer?.let { it.playWhenReady || it.isPlaying } == true
        },
        pausePlayback = { exoPlayer?.pause() },
        resumePlayback = { exoPlayer?.play() },
    )

    /** 由 MusicController 在构造后调用 */
    fun init() {
        initPlayer()
        observeAudioRendererPolicy()
        restoreIfPossible()
    }

    fun getStateStore(): PlayerStateStore = stateStore

    // ==================== ExoPlayer / MediaSession 初始化 ====================

    private fun initPlayer() {
        replacePlayer(
            useAudioEffectsRenderer = shouldUseAudioEffectsRenderer(),
            mediaItems = emptyList(),
            startIndex = 0,
            startPositionMs = 0L,
        )
        audioCoexistenceController.applyMode(SettingsPrefs.getAudioCoexistenceMode(context))
    }

    private fun buildPlayer(useAudioEffectsRenderer: Boolean): ExoPlayer {
        val builder = ExoPlayer.Builder(context)
        if (useAudioEffectsRenderer) {
            builder.setRenderersFactory(
                AudioEffectsRenderersFactory(
                    context,
                    audioEffectsManager.stereoWidenerAudioProcessor,
                ),
            )
        }
        val coexistenceMode = SettingsPrefs.getAudioCoexistenceMode(context)
        return builder
            .setMediaSourceFactory(playbackMediaCache.mediaSourceFactory())
            .setAudioAttributes(
                playbackAudioAttributes,
                coexistenceMode == SettingsPrefs.AudioCoexistenceMode.Off,
            )
            .setHandleAudioBecomingNoisy(true)
            .build()
            .apply {
                applyPlayMode(SettingsPrefs.getPlayMode(context))
                addListener(playerListener)
                audioEffectsManager.bindAudioSession(audioSessionId)
            }
    }

    private fun replacePlayer(
        useAudioEffectsRenderer: Boolean,
        mediaItems: List<MediaItem>,
        startIndex: Int,
        startPositionMs: Long,
    ): ExoPlayer {
        val oldPlayer = exoPlayer
        val oldSession = mediaSession
        oldPlayer?.removeListener(playerListener)
        oldSession?.release()
        mediaSession = null
        audioEffectsManager.release()
        if (oldPlayer != null) {
            oldPlayer.release()
            playbackMediaCache.release()
        }

        val player = buildPlayer(useAudioEffectsRenderer)
        usingAudioEffectsRenderer = useAudioEffectsRenderer
        if (mediaItems.isNotEmpty()) {
            player.setMediaItems(
                mediaItems,
                startIndex.coerceIn(0, mediaItems.lastIndex),
                startPositionMs.coerceAtLeast(0L),
            )
        }
        exoPlayer = player
        playlistManager.exoPlayer = player

        mediaSession = MediaSession.Builder(context, player)
            .setId("MusicSession-${System.currentTimeMillis()}")
            .setCallback(sessionCallback)
            .build()
        onPlayerChanged(player)
        return player
    }

    private fun shouldUseAudioEffectsRenderer(): Boolean =
        !audioEffectsRendererDisabledForSession &&
            AudioRendererPolicy.shouldUseAudioEffectsRenderer(audioEffectsManager.state.value)

    private fun observeAudioRendererPolicy() {
        if (audioRendererStateJob?.isActive == true) return
        audioRendererStateJob = CoroutineScope(Dispatchers.Main).launch {
            audioEffectsManager.state.collect { state ->
                val stateRequiresRenderer = AudioRendererPolicy.shouldUseAudioEffectsRenderer(state)
                if (!stateRequiresRenderer) {
                    audioEffectsRendererDisabledForSession = false
                }
                val target = !audioEffectsRendererDisabledForSession && stateRequiresRenderer
                if (exoPlayer != null && target != usingAudioEffectsRenderer) {
                    rebuildPlayerForRendererPolicy(target)
                }
            }
        }
    }

    private fun rebuildPlayerForRendererPolicy(useAudioEffectsRenderer: Boolean) {
        val player = exoPlayer ?: return
        val mediaItems = (0 until player.mediaItemCount).map { index -> player.getMediaItemAt(index) }
        val startIndex = if (mediaItems.isEmpty()) 0 else player.currentMediaItemIndex.coerceIn(0, mediaItems.lastIndex)
        val startPositionMs = player.currentPosition.coerceAtLeast(0L)
        val shouldPlay = player.playWhenReady
        val replacement = replacePlayer(
            useAudioEffectsRenderer = useAudioEffectsRenderer,
            mediaItems = mediaItems,
            startIndex = startIndex,
            startPositionMs = startPositionMs,
        )
        if (mediaItems.isNotEmpty()) {
            replacement.prepare()
            if (shouldPlay) replacement.play() else replacement.pause()
        }
    }

    private fun retryWithNativeRendererIfNeeded(error: PlaybackException): Boolean {
        if (!usingAudioEffectsRenderer || !AudioRendererPolicy.isAudioRendererError(error)) return false
        val player = exoPlayer ?: return false
        val mediaItems = (0 until player.mediaItemCount).map { index -> player.getMediaItemAt(index) }
        if (mediaItems.isEmpty()) return false
        val startIndex = player.currentMediaItemIndex.coerceIn(0, mediaItems.lastIndex)
        val song = playlistManager.playList.value.getOrNull(startIndex)
        val retryKey = song?.let { factory.keyOf(it) } ?: "index:$startIndex"
        if (!audioRendererRetryKeys.add(retryKey)) return false

        audioEffectsRendererDisabledForSession = true
        val startPositionMs = player.currentPosition.coerceAtLeast(0L)
        val shouldPlay = player.playWhenReady
        Log.w(TAG, "Retry playback with native renderer: ${buildPlaybackErrorSummary(error)?.toDebugString()}")
        val replacement = replacePlayer(
            useAudioEffectsRenderer = false,
            mediaItems = mediaItems,
            startIndex = startIndex,
            startPositionMs = startPositionMs,
        )
        replacement.prepare()
        if (shouldPlay) replacement.play() else replacement.pause()
        persistState(force = true)
        return true
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
            val previousIndex = playlistManager.currentIndex.value
            syncPlaybackCacheAt(previousIndex)
            val newIndex = player.currentMediaItemIndex

            if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO
                && playlistManager.hasPlayNext()
            ) {
                val song = playlistManager.dequeuePlayNext()!!
                val targetIndex = playlistManager.placePlayNextAt(newIndex, song)
                playlistManager.updateCurrentIndex(targetIndex)
                player.seekTo(targetIndex, 0)
                ensurePlayableAtIndex(targetIndex, autoPlay = true)
                return
            }

            playlistManager.updateCurrentIndex(newIndex)
            if (newIndex != previousIndex) syncPlaybackCacheAt(newIndex)
            val shouldContinuePlaying = player.playWhenReady
            when (reason) {
                Player.MEDIA_ITEM_TRANSITION_REASON_SEEK,
                Player.MEDIA_ITEM_TRANSITION_REASON_AUTO,
                Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT,
                -> ensurePlayableAtIndex(newIndex, autoPlay = shouldContinuePlaying)
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _isPlaying.value = isPlaying
            if (isPlaying) {
                audioCoexistenceController.onPlaybackStarted()
                startProgressUpdate()
            } else {
                stopProgressUpdate()
                updateProgressSnapshot()
            }
        }

        override fun onAudioSessionIdChanged(audioSessionId: Int) {
            audioEffectsManager.bindAudioSession(audioSessionId)
        }

        override fun onPlayerError(error: PlaybackException) {
            super.onPlayerError(error)
            val summary = buildPlaybackErrorSummary(error)
            recordPlaybackFailure(error, summary)
            logPlaybackFailure(summary)
            if (retryWithNativeRendererIfNeeded(error)) return
            handlePlaybackFailureAndSkip(error, summary)
        }

        @SuppressLint("SwitchIntDef")
        override fun onPlaybackStateChanged(playbackState: Int) {
            _playbackState.value = playbackState
            when (playbackState) {
                Player.STATE_BUFFERING,
                Player.STATE_READY,
                Player.STATE_ENDED,
                -> syncPlaybackCacheAt(playlistManager.currentIndex.value)
            }
            if (playbackState == Player.STATE_READY) {
                _isPlaying.value = exoPlayer?.isPlaying == true
            }
        }
    }

    private fun recordPlaybackFailure(error: PlaybackException, summary: PlaybackErrorSummary?) {
        val player = exoPlayer ?: return
        val song = playlistManager.playList.value.getOrNull(player.currentMediaItemIndex) ?: return
        if (song.type == SongType.LOCAL) return
        val resolvedUrl = player.currentMediaItem?.localConfiguration?.uri?.toString().orEmpty()
        val quality = factory.playbackQualityKeyOf(song)
        CoroutineScope(Dispatchers.IO).launch {
            playbackFaultRecorder.recordPlayerFailure(
                song = song,
                resolvedUrl = resolvedUrl,
                quality = quality,
                trace = null,
                error = error,
                diagnosticSummary = summary?.toDebugString().orEmpty(),
            )
        }
    }

    private fun buildPlaybackErrorSummary(error: Throwable?): PlaybackErrorSummary? {
        val player = exoPlayer
        val index = player?.currentMediaItemIndex ?: playlistManager.currentIndex.value
        val song = playlistManager.playList.value.getOrNull(index)
        if (song == null && error == null) return null
        val uri = player?.currentMediaItem?.localConfiguration?.uri?.toString()
            .orEmpty()
            .ifBlank { song?.id.orEmpty() }
        return PlaybackErrorSummary(
            songType = song?.type?.name ?: "UNKNOWN",
            uriScheme = uriSchemeOf(uri),
            errorCodeName = (error as? PlaybackException)?.errorCodeName
                ?: error?.javaClass?.simpleName
                ?: "unknown",
            cause = summarizeCause(error),
        )
    }

    private fun logPlaybackFailure(summary: PlaybackErrorSummary?) {
        if (summary == null) return
        Log.w(TAG, "Playback failure: ${summary.toDebugString()}")
    }

    private fun uriSchemeOf(value: String): String {
        val separator = value.indexOf(':')
        return if (separator > 0) value.substring(0, separator).lowercase() else "none"
    }

    private fun summarizeCause(error: Throwable?): String {
        var target = error
        while (target?.cause != null) {
            target = target.cause
        }
        if (target == null) return "unknown"
        val type = target.javaClass.name
        val message = target.message?.takeIf { it.isNotBlank() }
        return limitDiagnostic(if (message == null) type else "$type: $message")
    }

    private fun limitDiagnostic(value: String): String =
        if (value.length <= MAX_DIAGNOSTIC_LENGTH) value else value.take(MAX_DIAGNOSTIC_LENGTH)

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
                        KeyEvent.KEYCODE_MEDIA_NEXT -> {
                            if (keyEvent.repeatCount == 0) next(manual = true)
                            return true
                        }
                        KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
                            if (keyEvent.repeatCount == 0) previous(manual = true)
                            return true
                        }
                        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                            if (keyEvent.repeatCount == 0) onTogglePlayPause()
                            return true
                        }
                    }
                }
            }
            return false
        }

        @Deprecated("Media3 deprecated this hook, but it is still needed to keep system controls on the app entrypoint.")
        override fun onPlayerCommandRequest(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            playerCommand: Int,
        ): Int {
            return when (playerCommand) {
                Player.COMMAND_SEEK_TO_NEXT -> {
                    next(manual = true)
                    SessionResult.RESULT_INFO_SKIPPED
                }
                Player.COMMAND_SEEK_TO_PREVIOUS -> {
                    previous(manual = true)
                    SessionResult.RESULT_INFO_SKIPPED
                }
                Player.COMMAND_PLAY_PAUSE -> {
                    onTogglePlayPause()
                    SessionResult.RESULT_INFO_SKIPPED
                }
                else -> super.onPlayerCommandRequest(session, controller, playerCommand)
            }
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
    fun next(manual: Boolean = false) {
        val player = exoPlayer ?: return
        if (playlistManager.playList.value.isEmpty() || player.mediaItemCount == 0) return
        if (manual && shouldIgnoreManualNavigation(next = true)) return

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val queued = playlistManager.dequeuePlayNext()
                if (queued != null) {
                    val insertAt = player.currentMediaItemIndex + 1
                    val targetIndex = playlistManager.placePlayNextAt(insertAt, queued)
                    player.seekTo(targetIndex, 0)
                    ensurePlayableAtIndex(targetIndex, autoPlay = true)
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
    fun previous(manual: Boolean = false) {
        val player = exoPlayer ?: return
        if (playlistManager.playList.value.isEmpty() || player.mediaItemCount == 0) return
        if (manual && shouldIgnoreManualNavigation(next = false)) return

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
                    audioCoexistenceController.onUserPauseRequested()
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

    fun playCurrent() {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                ensurePlayableAtIndex(playlistManager.currentIndex.value, autoPlay = true)
                persistState(force = true)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun pauseCurrent() {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                audioCoexistenceController.onUserPauseRequested()
                exoPlayer?.pause()
                persistState(force = true)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun handlePlaybackRequestFailure() {
        handleExhaustedPlaybackFailure(null)
    }

    fun setPlaying(playing: Boolean) {
        val player = exoPlayer ?: return
        if (playing) {
            player.prepare()
            player.play()
        } else {
            audioCoexistenceController.onUserPauseRequested()
            player.pause()
        }
        persistState(force = true)
    }

    fun applyAudioCoexistenceMode(mode: SettingsPrefs.AudioCoexistenceMode) {
        exoPlayer?.setAudioAttributes(
            playbackAudioAttributes,
            mode == SettingsPrefs.AudioCoexistenceMode.Off,
        )
        audioCoexistenceController.applyMode(mode)
    }

    private fun shouldIgnoreManualNavigation(next: Boolean): Boolean {
        val now = System.currentTimeMillis()
        return if (next) {
            if (now - lastManualNextAtMs < MANUAL_NAVIGATION_DEBOUNCE_MS) {
                true
            } else {
                lastManualNextAtMs = now
                false
            }
        } else {
            if (now - lastManualPreviousAtMs < MANUAL_NAVIGATION_DEBOUNCE_MS) {
                true
            } else {
                lastManualPreviousAtMs = now
                false
            }
        }
    }

    suspend fun switchCurrentSongQuality(choice: DownloadQualityChoice): Boolean {
        val player = exoPlayer ?: return false
        val index = player.currentMediaItemIndex
        val song = playlistManager.playList.value.getOrNull(index) ?: return false
        if (song.type == SongType.LOCAL || index !in 0 until player.mediaItemCount) return false

        val songKey = factory.keyOf(song)
        val positionMs = player.currentPosition.coerceAtLeast(0L)
        val shouldPlay = player.playWhenReady || player.isPlaying

        return try {
            val resolved = withContext(Dispatchers.IO) {
                factory.createMediaItemWithQuality(song, choice)
            }
            val currentSong = playlistManager.playList.value.getOrNull(index) ?: return false
            if (factory.keyOf(currentSong) != songKey) return false

            replaceMediaItemAndRefreshCurrent(index, resolved, positionMs)
            player.seekTo(index, positionMs)
            player.prepare()
            if (shouldPlay) {
                player.play()
            } else {
                player.pause()
            }
            SettingsPrefs.setPlaybackQualityKey(context, song.type, choice.toPlaybackQualityKey())
            persistState(force = true)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    private fun startProgressUpdate() {
        if (progressUpdateJob?.isActive == true) return
        progressUpdateJob = CoroutineScope(Dispatchers.Main).launch {
            while (isActive) {
                updateProgressSnapshot()
                delay(PROGRESS_UPDATE_INTERVAL_MS)
            }
        }
    }

    private fun stopProgressUpdate() {
        progressUpdateJob?.cancel()
        progressUpdateJob = null
    }

    private fun updateProgressSnapshot() {
        exoPlayer?.let { player ->
            _currentPosition.value = player.currentPosition
            _duration.value = player.duration
            _progress.value = if (player.duration > 0) {
                (player.currentPosition * 100) / player.duration
            } else 0
            persistState(force = false)
        }
    }

    // ==================== 已登记媒体项播放 ====================

    /** 队列进入播放器前已在 IO 完成逻辑项登记；这里仅执行 Main 侧播放控制。 */
    fun ensurePlayableAtIndex(index: Int, autoPlay: Boolean) {
        CoroutineScope(Dispatchers.Main).launch {
            val player = exoPlayer ?: return@launch
            if (playlistManager.playList.value.getOrNull(index) == null) return@launch
            if (index !in 0 until player.mediaItemCount) return@launch
            playlistManager.updateCurrentIndex(index)
            if (player.currentMediaItemIndex != index) player.seekTo(index, 0)
            player.prepare()
            if (autoPlay) {
                player.play()
            }
            persistState(force = true)
        }
    }

    private fun handlePlaybackFailureAndSkip(
        error: Throwable? = null,
        previousSummary: PlaybackErrorSummary? = null,
    ) {
        // 恢复态（pause + prepare）若触发 source error，不应自动切歌导致看起来“自动播放”。
        val player = exoPlayer ?: return
        if (player.playWhenReady != true) return
        val summary = previousSummary ?: buildPlaybackErrorSummary(error)
        handleExhaustedPlaybackFailure(summary)
    }

    private fun handleExhaustedPlaybackFailure(summary: PlaybackErrorSummary?) {
        val now = System.currentTimeMillis()
        if (now - lastFailurePauseAtMs < 1200L) return
        lastFailurePauseAtMs = now

        val mode = SettingsPrefs.getAutoSwitchListMode(context)
        if (mode == SettingsPrefs.AutoSwitchListMode.Off) {
            pauseCurrentAfterPlaybackFailure(summary)
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            val fallback = withContext(Dispatchers.IO) {
                fallbackProvider.load(mode, factory)
            }
            if (fallback.songs.isEmpty()) {
                pauseCurrentAfterPlaybackFailure(summary)
                return@launch
            }
            playlistManager.setPlayListLazy(
                songs = fallback.songs,
                startIndex = 0,
                newSourceId = "auto_switch_${mode.name}_${System.currentTimeMillis()}",
            ) { result ->
                when (result) {
                    is PlaylistSetResult.Applied -> {
                        persistState(force = true)
                        ensurePlayableAtIndex(result.startIndex, autoPlay = true)
                        onPlaybackEvent(PlaybackUiEvent.AutoSwitched(mode))
                    }
                    PlaylistSetResult.Failed -> pauseCurrentAfterPlaybackFailure(summary)
                    PlaylistSetResult.SameSource,
                    PlaylistSetResult.Stale,
                    -> Unit
                }
            }
        }
    }

    private fun pauseCurrentAfterPlaybackFailure(summary: PlaybackErrorSummary?) {
        exoPlayer?.pause()
        persistState(force = true)
        onPlaybackEvent(PlaybackUiEvent.NetworkPoorPaused(summary))
    }

    private fun syncPlaybackCacheAt(index: Int) {
        val song = playlistManager.playList.value.getOrNull(index) ?: return
        if (song.type == SongType.LOCAL) return
        val player = exoPlayer ?: return
        if (index !in 0 until player.mediaItemCount) return
        val qualityKey = playbackMediaCache.qualityKeyOf(song, player.getMediaItemAt(index)) ?: return
        cacheSyncScope.launch {
            runCatching { playbackMediaCache.syncEntry(song, qualityKey) }
                .onFailure { error ->
                    Log.w(TAG, "Failed to synchronize playback cache catalog", error)
                }
        }
    }

    private fun replaceMediaItemAndRefreshCurrent(
        index: Int,
        mediaItem: MediaItem,
        startPositionMs: Long,
    ) {
        val player = exoPlayer ?: return
        if (index !in 0 until player.mediaItemCount) return
        if (index != player.currentMediaItemIndex) {
            player.replaceMediaItem(index, mediaItem)
            return
        }

        val items = (0 until player.mediaItemCount).map { itemIndex ->
            if (itemIndex == index) mediaItem else player.getMediaItemAt(itemIndex)
        }
        player.setMediaItems(items, index, startPositionMs.coerceAtLeast(0L))
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

    /** 启动时在 IO 构造完整逻辑队列，Main 一次性交付且不自动播放。 */
    private fun restoreIfPossible() {
        if (restoreAttempted) return
        restoreAttempted = true
        val restoreGeneration = playlistManager.beginRestorePreparation()
        CoroutineScope(Dispatchers.IO).launch {
            val state = stateStore.load() ?: return@launch
            if (state.songs.isEmpty()) return@launch
            val normalized = normalizePlaylist(
                songs = state.songs.map { it.toSongInfo() },
                currentIndex = state.currentIndex,
                keyOf = factory::keyOf,
            )
            val songs = normalized.songs
            val idx = normalized.currentIndex
            val pos = state.positionMs.coerceAtLeast(0L)
            val prepared = prepareRestoredQueue(
                values = songs,
                requestedIndex = idx,
                transform = factory::createMediaItem,
            ) ?: return@launch
            withContext(Dispatchers.Main) {
                if (!playlistManager.restorePreparedState(
                        generation = restoreGeneration,
                        songs = prepared.values,
                        index = prepared.currentIndex,
                    )
                ) {
                    return@withContext
                }
                val restoredPosition = if (prepared.selectedOriginalIndex == idx) pos else 0L
                exoPlayer?.apply {
                    clearMediaItems()
                    setMediaItems(prepared.items, prepared.currentIndex, restoredPosition)
                    applyPlayMode(SettingsPrefs.getPlayMode(context))
                    prepare()
                    pause()
                }
            }
        }
    }

    /** 释放 ExoPlayer 和 MediaSession */
    fun release() {
        if (released) return
        released = true
        audioRendererStateJob?.cancel()
        audioRendererStateJob = null
        cacheSyncJob.cancel()
        stopProgressUpdate()
        val player = exoPlayer
        exoPlayer = null
        playlistManager.exoPlayer = null
        audioCoexistenceController.release()
        audioEffectsManager.release()
        mediaSession?.release()
        mediaSession = null
        player?.release()
        playbackMediaCache.release()
    }

    private companion object {
        private const val TAG = "PlayerEngine"
        private const val PROGRESS_UPDATE_INTERVAL_MS = 160L
        private const val MANUAL_NAVIGATION_DEBOUNCE_MS = 650L
        private const val MAX_DIAGNOSTIC_LENGTH = 512
    }
}
