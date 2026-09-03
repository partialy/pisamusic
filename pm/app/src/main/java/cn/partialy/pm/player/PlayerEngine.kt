package cn.partialy.pm.player

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.SystemClock
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
import cn.partialy.pm.player.diagnostic.Media3ReasonNames
import cn.partialy.pm.player.diagnostic.PlaybackControlSource
import cn.partialy.pm.player.diagnostic.PlaybackDiagnosticEvent
import cn.partialy.pm.player.diagnostic.PlaybackDiagnosticEventType
import cn.partialy.pm.player.diagnostic.PlaybackDiagnosticRecorder
import cn.partialy.pm.player.diagnostic.PlaybackPlayerSnapshot
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.fault.PlaybackFaultRecorder
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale
import java.util.UUID

/**
 * 播放引擎：管理 ExoPlayer / MediaSession 生命周期、事件监听、进度追踪、
 * 播放模式切换、状态持久化，以及按需 URL 解析。
 *
 * [onNext] / [onPrevious] 由 MusicController 注入；
 * [onHardPauseObserved] 用于撤销 MusicController 内仍未落地的直接播放请求；
 * [onSongEnded] 仅报告自然播放完成。
 */
@UnstableApi
class PlayerEngine(
    private val context: Context,
    private val playlistManager: PlaylistManager,
    private val factory: MediaItemFactory,
    private val fallbackProvider: PlaybackFallbackProvider,
    private val playbackMediaCache: PlaybackMediaCache,
    private val playbackFaultRecorder: PlaybackFaultRecorder,
    private val playbackDiagnosticRecorder: PlaybackDiagnosticRecorder,
    private val audioEffectsManager: AudioEffectsManager,
    private val onNext: () -> Unit,
    private val onPrevious: () -> Unit,
    private val onHardPauseObserved: () -> Unit,
    private val onPlaybackEvent: (PlaybackUiEvent) -> Unit,
    private val onPlayerChanged: (ExoPlayer) -> Unit,
    private val onSongEnded: () -> Boolean,
) {
    var exoPlayer: ExoPlayer? = null
        private set
    var externalControlPlayer: Player? = null
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
    private var lastSeekDiscontinuityAtMs = 0L
    private var progressUpdateJob: Job? = null
    private var audioRendererStateJob: Job? = null
    private var released = false
    private var usingAudioEffectsRenderer = false
    private var audioEffectsRendererDisabledForSession = false
    private val audioRendererRetryKeys = mutableSetOf<String>()
    private val cacheSyncJob = SupervisorJob()
    private val cacheSyncScope = CoroutineScope(cacheSyncJob + Dispatchers.IO)
    private val engineJob = SupervisorJob()
    private val engineScope = CoroutineScope(engineJob + Dispatchers.Main.immediate)
    private val mediaRefreshGate = LatestRequestGate()
    private var mediaRefreshJob: Job? = null
    private var hardPauseRevision = 0L
    private var pendingControlContext: PendingControlContext? = null
    private val handledPauseRequestIds = LinkedHashSet<String>()
    private val playbackAudioAttributes = AudioAttributes.Builder()
        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
        .setUsage(C.USAGE_MEDIA)
        .build()
    private data class PendingControlContext(
        val requestId: String,
        val action: String,
        val source: PlaybackControlSource,
        val controllerPackage: String = "",
        val expectedPlayWhenReady: Boolean,
        val createdAtElapsed: Long,
    )

    private val audioCoexistenceController = AudioCoexistenceController(
        context = context,
        isPlaybackActive = {
            exoPlayer?.let { it.playWhenReady || it.isPlaying } == true
        },
        pausePlayback = {
            recordDiagnostic(
                eventType = PlaybackDiagnosticEventType.AUDIO_COEXISTENCE_BLOCKING,
                action = "pause",
                controlSource = PlaybackControlSource.AUDIO_COEXISTENCE,
                reason = "blocking_detected",
            )
            exoPlayer?.pause()
        },
        resumePlayback = {
            markControlRequest(
                action = "play",
                source = PlaybackControlSource.AUDIO_COEXISTENCE,
                reason = "coexistence_blocker_cleared",
            )
            recordDiagnostic(
                eventType = PlaybackDiagnosticEventType.AUDIO_COEXISTENCE_BLOCKING,
                action = "resume",
                controlSource = PlaybackControlSource.AUDIO_COEXISTENCE,
                reason = "coexistence_blocker_cleared",
            )
            exoPlayer?.play()
        },
        onSnapshotChanged = { snapshot ->
            recordDiagnostic(
                eventType = PlaybackDiagnosticEventType.AUDIO_COEXISTENCE_BLOCKING,
                action = snapshot.command.name.lowercase(Locale.ROOT),
                controlSource = PlaybackControlSource.AUDIO_COEXISTENCE,
                details = mapOf(
                    "communication_playback_active" to snapshot.communicationPlaybackActive.toString(),
                    "foreign_media_playback_active" to snapshot.foreignMediaPlaybackActive.toString(),
                    "recording_active" to snapshot.recordingActive.toString(),
                    "communication_mode_active" to snapshot.communicationModeActive.toString(),
                    "blocking" to snapshot.blocking.toString(),
                    "cj_active" to snapshot.cjActive.toString(),
                    "manual_play_override_active" to snapshot.manualPlayOverrideActive.toString(),
                    "mode" to snapshot.mode?.name?.lowercase(Locale.ROOT).orEmpty(),
                    "command" to snapshot.command.name.lowercase(Locale.ROOT),
                ),
            )
        },
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
        return builder
            .setMediaSourceFactory(playbackMediaCache.mediaSourceFactory())
            .setAudioAttributes(
                playbackAudioAttributes,
                SettingsPrefs.getAudioCoexistenceMode(context) == SettingsPrefs.AudioCoexistenceMode.Off,
            )
            .setHandleAudioBecomingNoisy(true)
            .build()
            .apply {
                applyPlayModeToPlayer(this, SettingsPrefs.getPlayMode(context))
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
        externalControlPlayer = null
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

        externalControlPlayer = PlaybackIntentForwardingPlayer(
            player = player,
            onPlayRequested = {
                onManualPlayRequested(PlaybackControlSource.EXTERNAL_DIRECT_PLAYER)
                markControlRequest("play", PlaybackControlSource.EXTERNAL_DIRECT_PLAYER)
            },
            onPauseRequested = {
                val context = markControlRequest("pause", PlaybackControlSource.EXTERNAL_DIRECT_PLAYER)
                handleHardPauseRequest(
                    reason = "explicit_pause_external_direct_player",
                    source = PlaybackControlSource.EXTERNAL_DIRECT_PLAYER,
                    handledRequestId = context.requestId,
                )
            },
        )
        mediaSession = MediaSession.Builder(context, requireNotNull(externalControlPlayer))
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
            val songEndedNaturally = reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO ||
                reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT
            if (songEndedNaturally && onSongEnded()) {
                player.pause()
                playlistManager.updateCurrentIndex(newIndex)
                if (newIndex != previousIndex) syncPlaybackCacheAt(newIndex)
                persistState(force = true)
                return
            }

            if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO
                && playlistManager.hasPlayNext()
            ) {
                val song = playlistManager.dequeuePlayNext()!!
                val targetIndex = playlistManager.placePlayNextAt(newIndex, song)
                pauseCloudBeforeRefresh(player, targetIndex)
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
                -> {
                    pauseCloudBeforeRefresh(player, newIndex)
                    ensurePlayableAtIndex(newIndex, autoPlay = shouldContinuePlaying)
                }
            }
        }

        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
            val now = SystemClock.elapsedRealtime()
            val currentContext = pendingControlContext
            val matchedContext = currentContext?.takeIf {
                it.expectedPlayWhenReady == playWhenReady &&
                    now - it.createdAtElapsed <= CONTROL_CONTEXT_TTL_MS
            }
            val handledPauseContext = currentContext?.takeIf {
                shouldTreatAsHandledExplicitPauseCallback(
                    context = it,
                    playWhenReady = playWhenReady,
                    reason = reason,
                )
            }
            val effectiveContext = matchedContext ?: handledPauseContext
            if (effectiveContext === currentContext) {
                pendingControlContext = null
            }
            val source = when {
                effectiveContext != null -> effectiveContext.source
                reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS ->
                    PlaybackControlSource.AUDIO_FOCUS
                reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY ->
                    PlaybackControlSource.AUDIO_BECOMING_NOISY
                else -> PlaybackControlSource.EXTERNAL_DIRECT_PLAYER
            }
            recordDiagnostic(
                eventType = PlaybackDiagnosticEventType.PLAY_WHEN_READY_CHANGED,
                action = if (playWhenReady) "play" else "pause",
                reason = Media3ReasonNames.playWhenReady(reason),
                controlSource = source,
                controllerPackage = effectiveContext?.controllerPackage.orEmpty(),
                details = effectiveContext?.let { mapOf("request_id" to it.requestId) }.orEmpty(),
            )
            handleObservedPlayIntent(
                playWhenReady = playWhenReady,
                reason = reason,
                source = source,
                hardPauseAlreadyHandled = effectiveContext?.let {
                    it.action == "pause" && consumeHandledPauseRequest(it.requestId)
                } == true,
            )
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            recordDiagnostic(
                eventType = PlaybackDiagnosticEventType.IS_PLAYING_CHANGED,
                action = if (isPlaying) "playing" else "paused",
                controlSource = PlaybackControlSource.UNKNOWN,
            )
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

        override fun onPlaybackSuppressionReasonChanged(playbackSuppressionReason: Int) {
            recordDiagnostic(
                eventType = PlaybackDiagnosticEventType.SUPPRESSION_CHANGED,
                reason = Media3ReasonNames.suppression(playbackSuppressionReason),
            )
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int,
        ) {
            if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                lastSeekDiscontinuityAtMs = SystemClock.elapsedRealtime()
            }
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
            recordDiagnostic(
                eventType = PlaybackDiagnosticEventType.PLAYBACK_STATE_CHANGED,
                action = Media3ReasonNames.playbackState(playbackState),
                controlSource = PlaybackControlSource.UNKNOWN,
                details = mapOf("state_code" to playbackState.toString()),
            )
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
            val endedAfterRecentSeek = SystemClock.elapsedRealtime() - lastSeekDiscontinuityAtMs <
                MANUAL_END_SEEK_GUARD_MS
            if (playbackState == Player.STATE_ENDED && !endedAfterRecentSeek) {
                if (onSongEnded()) exoPlayer?.pause()
            }
        }
    }

    private fun recordPlaybackFailure(error: PlaybackException, summary: PlaybackErrorSummary?) {
        val player = exoPlayer ?: return
        val song = playlistManager.playList.value.getOrNull(player.currentMediaItemIndex) ?: return
        if (song.type == SongType.LOCAL || song.type == SongType.CLOUD) return
        val currentMediaItem = player.currentMediaItem
        val resolvedUrl = currentMediaItem?.localConfiguration?.uri?.toString().orEmpty()
        val quality = currentMediaItem
            ?.let { runCatching { playbackMediaCache.qualityKeyOf(song, it) }.getOrNull() }
            ?: runCatching { factory.playbackQualityKeyOf(song) }
                .getOrNull()
                ?.takeIf(String::isNotBlank)
            ?: "unknown"
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
                            recordDiagnostic(
                                eventType = PlaybackDiagnosticEventType.MEDIA_BUTTON,
                                action = "next",
                                controlSource = PlaybackControlSource.MEDIA_BUTTON,
                                controllerPackage = controllerInfo.packageName,
                                details = mapOf(
                                    "key_code" to keyEvent.keyCode.toString(),
                                    "repeat_count" to keyEvent.repeatCount.toString(),
                                    "controller_package" to controllerInfo.packageName,
                                ),
                            )
                            if (keyEvent.repeatCount == 0) next(manual = true)
                            return true
                        }
                        KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
                            recordDiagnostic(
                                eventType = PlaybackDiagnosticEventType.MEDIA_BUTTON,
                                action = "previous",
                                controlSource = PlaybackControlSource.MEDIA_BUTTON,
                                controllerPackage = controllerInfo.packageName,
                                details = mapOf(
                                    "key_code" to keyEvent.keyCode.toString(),
                                    "repeat_count" to keyEvent.repeatCount.toString(),
                                    "controller_package" to controllerInfo.packageName,
                                ),
                            )
                            if (keyEvent.repeatCount == 0) previous(manual = true)
                            return true
                        }
                        KeyEvent.KEYCODE_MEDIA_PLAY -> {
                            recordDiagnostic(
                                eventType = PlaybackDiagnosticEventType.MEDIA_BUTTON,
                                action = "play",
                                controlSource = PlaybackControlSource.MEDIA_BUTTON,
                                controllerPackage = controllerInfo.packageName,
                                details = mapOf(
                                    "key_code" to keyEvent.keyCode.toString(),
                                    "repeat_count" to keyEvent.repeatCount.toString(),
                                    "controller_package" to controllerInfo.packageName,
                                ),
                            )
                            if (keyEvent.repeatCount == 0) {
                                playCurrent(
                                    source = PlaybackControlSource.MEDIA_BUTTON,
                                    controllerPackage = controllerInfo.packageName,
                                )
                            }
                            return true
                        }
                        KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                            recordDiagnostic(
                                eventType = PlaybackDiagnosticEventType.MEDIA_BUTTON,
                                action = "pause",
                                controlSource = PlaybackControlSource.MEDIA_BUTTON,
                                controllerPackage = controllerInfo.packageName,
                                details = mapOf(
                                    "key_code" to keyEvent.keyCode.toString(),
                                    "repeat_count" to keyEvent.repeatCount.toString(),
                                    "controller_package" to controllerInfo.packageName,
                                ),
                            )
                            if (keyEvent.repeatCount == 0) {
                                pauseCurrent(
                                    source = PlaybackControlSource.MEDIA_BUTTON,
                                    controllerPackage = controllerInfo.packageName,
                                )
                            }
                            return true
                        }
                        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                            recordDiagnostic(
                                eventType = PlaybackDiagnosticEventType.MEDIA_BUTTON,
                                action = "play_pause",
                                controlSource = PlaybackControlSource.MEDIA_BUTTON,
                                controllerPackage = controllerInfo.packageName,
                                details = mapOf(
                                    "key_code" to keyEvent.keyCode.toString(),
                                    "repeat_count" to keyEvent.repeatCount.toString(),
                                    "controller_package" to controllerInfo.packageName,
                                ),
                            )
                            if (keyEvent.repeatCount == 0) {
                                togglePlayPause(
                                    source = PlaybackControlSource.MEDIA_BUTTON,
                                    controllerPackage = controllerInfo.packageName,
                                )
                            }
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
                    recordDiagnostic(
                        eventType = PlaybackDiagnosticEventType.MEDIA_SESSION_COMMAND,
                        action = "seek_to_next",
                        controlSource = PlaybackControlSource.MEDIA_SESSION,
                        controllerPackage = controller.packageName,
                    )
                    SessionResult.RESULT_INFO_SKIPPED
                }
                Player.COMMAND_SEEK_TO_PREVIOUS -> {
                    previous(manual = true)
                    recordDiagnostic(
                        eventType = PlaybackDiagnosticEventType.MEDIA_SESSION_COMMAND,
                        action = "seek_to_previous",
                        controlSource = PlaybackControlSource.MEDIA_SESSION,
                        controllerPackage = controller.packageName,
                    )
                    SessionResult.RESULT_INFO_SKIPPED
                }
                Player.COMMAND_PLAY_PAUSE -> {
                    recordDiagnostic(
                        eventType = PlaybackDiagnosticEventType.MEDIA_SESSION_COMMAND,
                        action = "command_play_pause",
                        controlSource = PlaybackControlSource.MEDIA_SESSION,
                        controllerPackage = controller.packageName,
                    )
                    super.onPlayerCommandRequest(session, controller, playerCommand)
                }
                else -> super.onPlayerCommandRequest(session, controller, playerCommand)
            }
        }

        override fun onConnect(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
        ): MediaSession.ConnectionResult {
            val result = super.onConnect(session, controller)
            val playerCommands = result.availablePlayerCommands.buildUpon()
                .add(Player.COMMAND_SEEK_TO_NEXT)
                .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                .add(Player.COMMAND_PLAY_PAUSE)
                .build()
            return MediaSession.ConnectionResult.accept(
                result.availableSessionCommands,
                playerCommands,
            )
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
        if (manual) onManualPlayRequested(PlaybackControlSource.APP_UI)

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val queued = playlistManager.dequeuePlayNext()
                if (queued != null) {
                    val insertAt = player.currentMediaItemIndex + 1
                    val targetIndex = playlistManager.placePlayNextAt(insertAt, queued)
                    ensurePlayableAtIndex(targetIndex, autoPlay = true)
                    return@launch
                }

                val idx = player.currentMediaItemIndex
                val targetIndex = if (player.shuffleModeEnabled) {
                    player.nextMediaItemIndex.takeIf { it >= 0 } ?: return@launch
                } else {
                    val last = player.mediaItemCount - 1
                    if (idx >= last) 0 else idx + 1
                }
                ensurePlayableAtIndex(targetIndex, autoPlay = true)
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
        if (manual) onManualPlayRequested(PlaybackControlSource.APP_UI)

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val idx = player.currentMediaItemIndex
                val targetIndex = if (player.shuffleModeEnabled) {
                    player.previousMediaItemIndex.takeIf { it >= 0 } ?: return@launch
                } else {
                    val last = player.mediaItemCount - 1
                    if (idx <= 0) last else idx - 1
                }
                ensurePlayableAtIndex(targetIndex, autoPlay = true)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /** 播放/暂停切换 */
    fun togglePlayPause(source: PlaybackControlSource = PlaybackControlSource.APP_UI) {
        togglePlayPause(source = source, controllerPackage = "")
    }

    private fun togglePlayPause(
        source: PlaybackControlSource,
        controllerPackage: String,
    ) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val player = exoPlayer ?: return@launch
                if (player.playWhenReady) {
                    pauseCurrent(source = source, controllerPackage = controllerPackage)
                } else {
                    onManualPlayRequested(source)
                    playCurrent(source = source, controllerPackage = controllerPackage)
                }
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
        exoPlayer?.let { applyPlayModeToPlayer(it, mode) }
    }

    private fun applyPlayModeToPlayer(player: ExoPlayer, mode: SettingsPrefs.PlayMode) {
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

    fun playCurrent(source: PlaybackControlSource = PlaybackControlSource.APP_UI) {
        playCurrent(source = source, controllerPackage = "")
    }

    private fun playCurrent(
        source: PlaybackControlSource,
        controllerPackage: String,
    ) {
        onManualPlayRequested(source)
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val player = exoPlayer ?: return@launch
                if (player.playWhenReady) {
                    recordDiagnostic(
                        eventType = PlaybackDiagnosticEventType.CONTROL_REQUEST,
                        action = "already_desired_play",
                        controlSource = source,
                        controllerPackage = controllerPackage,
                    )
                    return@launch
                }
                markControlRequest("play", source, controllerPackage)
                ensurePlayableAtIndex(playlistManager.currentIndex.value, autoPlay = true)
                persistState(force = true)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun pauseCurrent(source: PlaybackControlSource = PlaybackControlSource.APP_UI) {
        pauseCurrent(source = source, controllerPackage = "")
    }

    private fun pauseCurrent(
        source: PlaybackControlSource,
        controllerPackage: String,
    ) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val context = markControlRequest("pause", source, controllerPackage)
                handleHardPauseRequest(
                    reason = "explicit_pause",
                    source = source,
                    controllerPackage = controllerPackage,
                    handledRequestId = context.requestId,
                )
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

    fun setPlaying(
        playing: Boolean,
        source: PlaybackControlSource = PlaybackControlSource.APP_UI,
    ) {
        if (playing) {
            onManualPlayRequested(source)
            playCurrent(source)
        } else {
            pauseCurrent(source)
        }
    }

    fun applyAudioCoexistenceMode(mode: SettingsPrefs.AudioCoexistenceMode) {
        audioCoexistenceController.applyMode(mode)
        exoPlayer?.setAudioAttributes(
            playbackAudioAttributes,
            mode == SettingsPrefs.AudioCoexistenceMode.Off,
        )
    }

    /** 供直接点歌等异步播放入口在取链前登记本机播放意图。 */
    fun onManualPlayRequested(source: PlaybackControlSource) {
        if (source.isManualPlayRequest()) {
            audioCoexistenceController.onManualPlayRequested()
        }
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

    private fun PlaybackControlSource.isManualPlayRequest(): Boolean = when (this) {
        PlaybackControlSource.APP_UI,
        PlaybackControlSource.MEDIA_BUTTON,
        PlaybackControlSource.MEDIA_SESSION,
        PlaybackControlSource.EXTERNAL_DIRECT_PLAYER,
        -> true

        else -> false
    }

    suspend fun switchCurrentSongQuality(choice: DownloadQualityChoice): Boolean {
        val player = exoPlayer ?: return false
        val index = player.currentMediaItemIndex
        val song = playlistManager.playList.value.getOrNull(index) ?: return false
        if (!song.playable || song.type == SongType.LOCAL || index !in 0 until player.mediaItemCount) return false

        val refreshToken = mediaRefreshGate.next()
        val requestedPauseRevision = hardPauseRevision
        mediaRefreshJob?.cancel()
        mediaRefreshJob = null
        val songKey = factory.keyOf(song)
        val positionMs = player.currentPosition.coerceAtLeast(0L)
        val shouldPlay = player.playWhenReady || player.isPlaying

        return try {
            val resolved = withContext(Dispatchers.IO) {
                factory.createMediaItemWithQuality(song, choice)
            }
            if (!mediaRefreshGate.isLatest(refreshToken) || exoPlayer !== player) return false
            val currentSong = playlistManager.playList.value.getOrNull(index) ?: return false
            if (factory.keyOf(currentSong) != songKey) return false

            replaceMediaItemAndRefreshCurrent(index, resolved, positionMs)
            player.seekTo(index, positionMs)
            player.prepare()
            val staleToken = !mediaRefreshGate.isLatest(refreshToken)
            val hardPaused = requestedPauseRevision != hardPauseRevision
            val stillWantsPlay = player.playWhenReady
            if (shouldPlay && !staleToken && !hardPaused && stillWantsPlay) {
                player.play()
                recordAsyncPlayApplied(
                    song = currentSong,
                    requestedPauseRevision = requestedPauseRevision,
                    action = "quality_refresh",
                )
            } else {
                player.pause()
                if (shouldPlay && (staleToken || hardPaused || !stillWantsPlay)) {
                    recordAsyncDropForSong(
                        song = currentSong,
                        reason = if (staleToken) "stale_token" else "quality_refresh_hard_paused",
                        requestedPauseRevision = requestedPauseRevision,
                        action = "quality_refresh",
                    )
                }
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

    /** 新的列表或直接播放请求可使尚未返回的 Cloud 签发结果失去提交资格。 */
    fun invalidatePendingMediaRefresh() {
        mediaRefreshGate.invalidate()
        mediaRefreshJob?.cancel()
        mediaRefreshJob = null
    }

    /**
     * 唯一的队列媒体项激活入口。Cloud 在临近播放时重新签发，并在 Main 线程确认
     * type+id、播放器实例和请求代次仍一致后原子替换对应 MediaItem。
     */
    fun ensurePlayableAtIndex(index: Int, autoPlay: Boolean) {
        val token = mediaRefreshGate.next()
        val requestedPauseRevision = hardPauseRevision
        mediaRefreshJob?.cancel()
        mediaRefreshJob = engineScope.launch {
            val expectedPlayer = exoPlayer ?: return@launch
            val expectedSong = playlistManager.playList.value.getOrNull(index) ?: return@launch
            if (!expectedSong.playable || index !in 0 until expectedPlayer.mediaItemCount) return@launch
            val expectedKey = factory.keyOf(expectedSong)
            val startPositionMs = if (expectedPlayer.currentMediaItemIndex == index) {
                expectedPlayer.currentPosition.coerceAtLeast(0L)
            } else {
                0L
            }

            try {
                val refreshedCloudItem = if (expectedSong.type == SongType.CLOUD) {
                    pauseCloudBeforeRefresh(expectedPlayer, index)
                    withContext(Dispatchers.IO) { factory.createMediaItem(expectedSong) }
                } else {
                    null
                }
                if (!mediaRefreshGate.isLatest(token)) {
                    recordAsyncDropForSong(
                        song = expectedSong,
                        reason = "stale_token",
                        requestedPauseRevision = requestedPauseRevision,
                    )
                    return@launch
                }

                val player = exoPlayer ?: return@launch
                if (player !== expectedPlayer || index !in 0 until player.mediaItemCount) return@launch
                val currentSong = playlistManager.playList.value.getOrNull(index) ?: return@launch
                if (factory.keyOf(currentSong) != expectedKey || !currentSong.playable) return@launch

                if (refreshedCloudItem != null) {
                    replaceMediaItemAndRefreshCurrent(index, refreshedCloudItem, startPositionMs)
                }
                if (!mediaRefreshGate.isLatest(token)) {
                    recordAsyncDropForSong(
                        song = expectedSong,
                        reason = "stale_token",
                        requestedPauseRevision = requestedPauseRevision,
                    )
                    return@launch
                }

                val activePlayer = exoPlayer ?: return@launch
                val activeSong = playlistManager.playList.value.getOrNull(index) ?: return@launch
                if (activePlayer !== expectedPlayer || factory.keyOf(activeSong) != expectedKey) return@launch
                playlistManager.updateCurrentIndex(index)
                if (activePlayer.currentMediaItemIndex != index) {
                    activePlayer.seekTo(index, startPositionMs)
                }
                activePlayer.prepare()
                if (!mediaRefreshGate.isLatest(token)) {
                    recordAsyncDropForSong(
                        song = expectedSong,
                        reason = "stale_token",
                        requestedPauseRevision = requestedPauseRevision,
                    )
                    return@launch
                }
                if (autoPlay && requestedPauseRevision != hardPauseRevision) {
                    recordAsyncDropForSong(
                        song = expectedSong,
                        reason = "hard_pause_after_request",
                        requestedPauseRevision = requestedPauseRevision,
                    )
                    activePlayer.pause()
                    return@launch
                }
                if (autoPlay) {
                    activePlayer.play()
                    recordAsyncPlayApplied(
                        song = activeSong,
                        requestedPauseRevision = requestedPauseRevision,
                        action = "ensure_playable",
                    )
                } else {
                    activePlayer.pause()
                }
                persistState(force = true)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                if (!mediaRefreshGate.isLatest(token)) return@launch
                Log.w(TAG, "Failed to refresh media item before playback: $expectedKey", error)
                if (autoPlay) handlePlaybackRequestFailure() else exoPlayer?.pause()
            }
        }
    }

    /** 自动切换已落到 Cloud 占位项时先暂停，避免播放器尝试读取占位 URI。 */
    private fun pauseCloudBeforeRefresh(player: ExoPlayer, index: Int) {
        val song = playlistManager.playList.value.getOrNull(index) ?: return
        if (song.type == SongType.CLOUD && player.currentMediaItemIndex == index) {
            player.pause()
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
        val requestedPauseRevision = hardPauseRevision

        CoroutineScope(Dispatchers.Main).launch {
            val fallback = withContext(Dispatchers.IO) {
                fallbackProvider.load(mode, factory)
            }
            if (requestedPauseRevision != hardPauseRevision) {
                recordFallbackHardPause(
                    song = fallback.songs.firstOrNull(),
                    requestedPauseRevision = requestedPauseRevision,
                )
                return@launch
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
                if (requestedPauseRevision != hardPauseRevision) {
                    recordFallbackHardPause(
                        song = fallback.songs.firstOrNull(),
                        requestedPauseRevision = requestedPauseRevision,
                    )
                    return@setPlayListLazy
                }
                when (result) {
                    is PlaylistSetResult.Applied -> {
                        if (requestedPauseRevision != hardPauseRevision) {
                            recordFallbackHardPause(
                                song = result.songs.getOrNull(result.startIndex),
                                requestedPauseRevision = requestedPauseRevision,
                            )
                            return@setPlayListLazy
                        }
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

    private fun markControlRequest(
        action: String,
        source: PlaybackControlSource,
        controllerPackage: String = "",
        reason: String = "",
    ): PendingControlContext {
        val expectedPlayWhenReady = when (action) {
            "play" -> true
            "pause" -> false
            else -> error("Only explicit play/pause can create a pending context")
        }
        val context = PendingControlContext(
            requestId = UUID.randomUUID().toString(),
            action = action,
            source = source,
            controllerPackage = controllerPackage,
            expectedPlayWhenReady = expectedPlayWhenReady,
            createdAtElapsed = SystemClock.elapsedRealtime(),
        )
        pendingControlContext = context
        recordDiagnostic(
            eventType = PlaybackDiagnosticEventType.CONTROL_REQUEST,
            action = action,
            reason = reason,
            controlSource = source,
            controllerPackage = controllerPackage,
            details = mapOf("request_id" to context.requestId),
        )
        return context
    }

    private fun handleObservedPlayIntent(
        playWhenReady: Boolean,
        reason: Int,
        source: PlaybackControlSource,
        hardPauseAlreadyHandled: Boolean,
    ) {
        val disposition = audioCoexistenceController.onPlayWhenReadyChanged(playWhenReady)
        if (playWhenReady || disposition == AudioCoexistencePauseDisposition.OWN_PAUSE_OBSERVED) {
            return
        }
        if (hardPauseAlreadyHandled) return
        invalidatePendingPlayback(
            reason = "${Media3ReasonNames.playWhenReady(reason)}:${source.name.lowercase(Locale.ROOT)}",
            controlSource = source,
        )
    }

    private fun handleHardPauseRequest(
        reason: String,
        source: PlaybackControlSource,
        controllerPackage: String = "",
        handledRequestId: String? = null,
    ) {
        audioCoexistenceController.cancelPendingResume()
        handledRequestId?.let(::rememberHandledPauseRequest)
        invalidatePendingPlayback(
            reason = reason,
            controlSource = source,
            controllerPackage = controllerPackage,
        )
    }

    private fun rememberHandledPauseRequest(requestId: String) {
        handledPauseRequestIds.add(requestId)
        while (handledPauseRequestIds.size > MAX_HANDLED_PAUSE_REQUEST_IDS) {
            val oldest = handledPauseRequestIds.firstOrNull() ?: break
            handledPauseRequestIds.remove(oldest)
        }
    }

    private fun consumeHandledPauseRequest(requestId: String): Boolean =
        handledPauseRequestIds.remove(requestId)

    private fun shouldTreatAsHandledExplicitPauseCallback(
        context: PendingControlContext,
        playWhenReady: Boolean,
        reason: Int,
    ): Boolean =
        !playWhenReady &&
            reason == Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST &&
            context.action == "pause" &&
            context.expectedPlayWhenReady == false &&
            handledPauseRequestIds.contains(context.requestId)

    private fun invalidatePendingPlayback(
        reason: String,
        controlSource: PlaybackControlSource = PlaybackControlSource.UNKNOWN,
        controllerPackage: String = "",
        details: Map<String, String> = emptyMap(),
    ) {
        hardPauseRevision += 1L
        mediaRefreshGate.invalidate()
        mediaRefreshJob?.cancel()
        mediaRefreshJob = null
        onHardPauseObserved()
        recordDiagnostic(
            eventType = PlaybackDiagnosticEventType.ASYNC_PLAY_DROPPED,
            action = "invalidate_pending_playback",
            reason = reason,
            controlSource = controlSource,
            controllerPackage = controllerPackage,
            details = details,
        )
        Log.d(TAG, "Invalidate pending playback: $reason")
    }

    private fun asyncPlaybackDetails(
        song: SongInfo,
        requestedPauseRevision: Long,
    ): Map<String, String> = mapOf(
        "target_source" to song.type.name.lowercase(Locale.ROOT),
        "target_song_id" to song.id.take(256),
        "requested_pause_revision" to requestedPauseRevision.toString(),
    )

    private fun recordAsyncPlayApplied(
        song: SongInfo,
        requestedPauseRevision: Long,
        action: String,
        source: PlaybackControlSource = PlaybackControlSource.ASYNC_MEDIA_REFRESH,
    ) {
        recordDiagnostic(
            eventType = PlaybackDiagnosticEventType.ASYNC_PLAY_APPLIED,
            action = action,
            controlSource = source,
            details = asyncPlaybackDetails(song, requestedPauseRevision),
        )
    }

    private fun recordAsyncDropForSong(
        song: SongInfo,
        reason: String,
        requestedPauseRevision: Long,
        action: String = "drop",
        source: PlaybackControlSource = PlaybackControlSource.ASYNC_MEDIA_REFRESH,
    ) {
        recordDiagnostic(
            eventType = PlaybackDiagnosticEventType.ASYNC_PLAY_DROPPED,
            action = action,
            reason = reason,
            controlSource = source,
            details = asyncPlaybackDetails(song, requestedPauseRevision),
        )
    }

    private fun recordFallbackHardPause(song: SongInfo?, requestedPauseRevision: Long) {
        if (song == null) {
            recordDiagnostic(
                eventType = PlaybackDiagnosticEventType.ASYNC_PLAY_DROPPED,
                action = "fallback_refresh",
                reason = "fallback_hard_paused",
                controlSource = PlaybackControlSource.PLAYBACK_FAILURE,
            )
            return
        }
        recordAsyncDropForSong(
            song = song,
            reason = "fallback_hard_paused",
            requestedPauseRevision = requestedPauseRevision,
            action = "fallback_refresh",
            source = PlaybackControlSource.PLAYBACK_FAILURE,
        )
    }

    private fun recordDiagnostic(
        eventType: PlaybackDiagnosticEventType,
        action: String = "",
        reason: String = "",
        controlSource: PlaybackControlSource = PlaybackControlSource.UNKNOWN,
        controllerPackage: String = "",
        details: Map<String, String> = emptyMap(),
    ) {
        playbackDiagnosticRecorder.record(
            PlaybackDiagnosticEvent(
                eventType = eventType,
                action = action,
                reason = reason,
                controlSource = controlSource,
                controllerPackage = controllerPackage,
                snapshot = currentDiagnosticSnapshot(),
                details = details,
            ),
        )
    }

    private fun currentDiagnosticSnapshot(): PlaybackPlayerSnapshot {
        val player = exoPlayer
        val song = playlistManager.currentSong.value
        return PlaybackPlayerSnapshot(
            songSource = song?.type?.name?.lowercase().orEmpty(),
            songId = song?.id.orEmpty(),
            playWhenReady = player?.playWhenReady == true,
            isPlaying = player?.isPlaying == true,
            playbackState = player?.playbackState ?: Player.STATE_IDLE,
            suppressionReason = player?.playbackSuppressionReason
                ?: Player.PLAYBACK_SUPPRESSION_REASON_NONE,
            positionMs = player?.currentPosition?.coerceAtLeast(0L) ?: 0L,
        )
    }

    private fun syncPlaybackCacheAt(index: Int) {
        val song = playlistManager.playList.value.getOrNull(index) ?: return
        if (song.type == SongType.LOCAL || song.type == SongType.CLOUD) return
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
            val prepared = prepareRestoredQueueSuspending(
                values = songs,
                requestedIndex = idx,
                transform = factory::createQueueMediaItem,
            ) ?: return@launch
            val restoredItems = prepared.items.toMutableList()
            var restoredIndex = prepared.currentIndex
            if (prepared.values[restoredIndex].type == SongType.CLOUD) {
                var resolvedIndex: Int? = null
                for (offset in prepared.values.indices) {
                    val candidateIndex = (prepared.currentIndex + offset) % prepared.values.size
                    val candidateSong = prepared.values[candidateIndex]
                    val candidateItem = if (candidateSong.type == SongType.CLOUD) {
                        runCatching { factory.createMediaItem(candidateSong) }.getOrNull()
                    } else {
                        restoredItems[candidateIndex]
                    }
                    if (candidateItem != null) {
                        restoredItems[candidateIndex] = candidateItem
                        resolvedIndex = candidateIndex
                        break
                    }
                }
                restoredIndex = resolvedIndex ?: return@launch
            }
            withContext(Dispatchers.Main) {
                if (!playlistManager.restorePreparedState(
                        generation = restoreGeneration,
                        songs = prepared.values,
                        index = restoredIndex,
                    )
                ) {
                    return@withContext
                }
                val restoredPosition = if (
                    restoredIndex == prepared.currentIndex && prepared.selectedOriginalIndex == idx
                ) {
                    pos
                } else {
                    0L
                }
                exoPlayer?.apply {
                    clearMediaItems()
                    setMediaItems(restoredItems, restoredIndex, restoredPosition)
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
        mediaRefreshGate.invalidate()
        mediaRefreshJob?.cancel()
        mediaRefreshJob = null
        engineJob.cancel()
        stopProgressUpdate()
        val player = exoPlayer
        exoPlayer = null
        externalControlPlayer = null
        playlistManager.exoPlayer = null
        audioCoexistenceController.release()
        audioEffectsManager.release()
        mediaSession?.release()
        mediaSession = null
        player?.release()
        playbackMediaCache.shutdown()
    }

    private companion object {
        private const val TAG = "PlayerEngine"
        private const val CONTROL_CONTEXT_TTL_MS = 2_000L
        private const val MAX_HANDLED_PAUSE_REQUEST_IDS = 32
        private const val PROGRESS_UPDATE_INTERVAL_MS = 160L
        private const val MANUAL_NAVIGATION_DEBOUNCE_MS = 650L
        private const val MANUAL_END_SEEK_GUARD_MS = 1_000L
        private const val MAX_DIAGNOSTIC_LENGTH = 512
    }
}
