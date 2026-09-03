package cn.partialy.pm.player

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.AudioPlaybackConfiguration
import android.media.AudioRecordingConfiguration
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.annotation.RequiresApi
import cn.partialy.pm.utils.SettingsPrefs
import java.util.concurrent.Executor

internal enum class AudioCoexistenceCommand {
    None,
    Pause,
    Resume,
}

internal enum class AudioCoexistencePauseDisposition {
    NONE,
    OWN_PAUSE_OBSERVED,
    EXTERNAL_PAUSE_CANCELLED_RESUME,
}

internal data class AudioCoexistenceSnapshot(
    val communicationPlaybackActive: Boolean,
    val foreignMediaPlaybackActive: Boolean,
    val recordingActive: Boolean,
    val communicationModeActive: Boolean,
    val blocking: Boolean,
    val cjActive: Boolean,
    val manualPlayOverrideActive: Boolean,
    val mode: SettingsPrefs.AudioCoexistenceMode?,
    val command: AudioCoexistenceCommand,
)

internal class AudioCoexistenceStateMachine {
    private var mode = SettingsPrefs.AudioCoexistenceMode.All
    private var cjActive = false
    private var manualPlayOverrideActive = false
    private var resumeWhenClear = false
    private var awaitingOwnPauseCallback = false

    val currentMode: SettingsPrefs.AudioCoexistenceMode
        get() = mode

    val isCjActive: Boolean
        get() = cjActive

    val isManualPlayOverrideActive: Boolean
        get() = manualPlayOverrideActive

    fun setMode(
        mode: SettingsPrefs.AudioCoexistenceMode,
        cjActive: Boolean,
        playbackActive: Boolean,
    ): AudioCoexistenceCommand {
        if (this.mode == mode) return AudioCoexistenceCommand.None

        this.mode = mode
        clearState()
        if (!modeRequiresPause()) {
            return AudioCoexistenceCommand.None
        }
        return updateCj(cjActive, playbackActive)
    }

    fun updateCj(cjActive: Boolean, playbackActive: Boolean): AudioCoexistenceCommand {
        if (!modeRequiresPause()) return AudioCoexistenceCommand.None

        val cjEntered = !this.cjActive && cjActive
        val cjExited = this.cjActive && !cjActive
        this.cjActive = cjActive
        if (cjEntered) {
            if (!playbackActive || manualPlayOverrideActive) return AudioCoexistenceCommand.None
            resumeWhenClear = true
            awaitingOwnPauseCallback = true
            awaitingOwnPauseCallback = true
            return AudioCoexistenceCommand.Pause
        }
        if (!cjExited) return AudioCoexistenceCommand.None

        manualPlayOverrideActive = false
        val shouldResume = resumeWhenClear && !awaitingOwnPauseCallback
        resumeWhenClear = false
        awaitingOwnPauseCallback = false
        awaitingOwnPauseCallback = false
        return if (shouldResume) AudioCoexistenceCommand.Resume else AudioCoexistenceCommand.None
    }

    fun onManualPlayRequested() {
        if (modeRequiresPause() && cjActive) {
            resumeWhenClear = false
            awaitingOwnPauseCallback = false
            manualPlayOverrideActive = true
        }
    }

    fun onPlayWhenReadyChanged(playWhenReady: Boolean): AudioCoexistencePauseDisposition {
        if (!modeRequiresPause()) return AudioCoexistencePauseDisposition.NONE
        if (playWhenReady) return AudioCoexistencePauseDisposition.NONE
        if (awaitingOwnPauseCallback) {
            awaitingOwnPauseCallback = false
            return AudioCoexistencePauseDisposition.OWN_PAUSE_OBSERVED
        }
        resumeWhenClear = false
        return AudioCoexistencePauseDisposition.EXTERNAL_PAUSE_CANCELLED_RESUME
    }

    fun cancelPendingResume() {
        resumeWhenClear = false
        awaitingOwnPauseCallback = false
    }

    fun reset() {
        mode = SettingsPrefs.AudioCoexistenceMode.All
        clearState()
    }

    private fun modeRequiresPause(): Boolean = mode == SettingsPrefs.AudioCoexistenceMode.Partial

    private fun clearState() {
        cjActive = false
        manualPlayOverrideActive = false
        resumeWhenClear = false
        awaitingOwnPauseCallback = false
        awaitingOwnPauseCallback = false
    }
}

internal object AudioInterruptionClassifier {
    fun isCommunicationUsage(usage: Int): Boolean = when (usage) {
        AudioAttributes.USAGE_VOICE_COMMUNICATION,
        AudioAttributes.USAGE_VOICE_COMMUNICATION_SIGNALLING,
        -> true
        else -> false
    }

    fun isBlockingRecording(source: Int, clientSilenced: Boolean): Boolean {
        if (clientSilenced) return false
        return when (source) {
            MediaRecorder.AudioSource.DEFAULT,
            MediaRecorder.AudioSource.MIC,
            MediaRecorder.AudioSource.VOICE_UPLINK,
            MediaRecorder.AudioSource.VOICE_DOWNLINK,
            MediaRecorder.AudioSource.VOICE_CALL,
            MediaRecorder.AudioSource.CAMCORDER,
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            MediaRecorder.AudioSource.UNPROCESSED,
            MediaRecorder.AudioSource.VOICE_PERFORMANCE,
            MediaRecorder.AudioSource.REMOTE_SUBMIX,
            -> true
            else -> false
        }
    }

    fun isCommunicationMode(mode: Int): Boolean = when (mode) {
        AudioManager.MODE_RINGTONE,
        AudioManager.MODE_IN_CALL,
        AudioManager.MODE_IN_COMMUNICATION,
        AudioManager.MODE_CALL_SCREENING,
        -> true
        else -> false
    }

    fun isCjActive(
        mode: SettingsPrefs.AudioCoexistenceMode,
        communicationPlaybackActive: Boolean,
        recordingActive: Boolean,
        communicationModeActive: Boolean,
    ): Boolean = mode == SettingsPrefs.AudioCoexistenceMode.Partial &&
        (communicationPlaybackActive || recordingActive || communicationModeActive)
}

internal class AudioCoexistenceController(
    context: Context,
    private val isPlaybackActive: () -> Boolean,
    private val pausePlayback: () -> Unit,
    private val resumePlayback: () -> Unit,
    private val onSnapshotChanged: (AudioCoexistenceSnapshot) -> Unit = {},
    private val onSnapshotChanged: (AudioCoexistenceSnapshot) -> Unit = {},
) {
    private val audioManager = context.applicationContext
        .getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private val stateMachine = AudioCoexistenceStateMachine()
    private var observing = false
    private var observationSession = 0L
    private var communicationPlaybackActive = false
    private var recordingActive = false
    private var communicationModeActive = false
    private var playbackCallback: AudioManager.AudioPlaybackCallback? = null
    private var recordingCallback: AudioManager.AudioRecordingCallback? = null
    private var modeChangeObserver: ModeChangeObserver? = null
    private var legacyModePoll: Runnable? = null
    private var lastSnapshot: AudioCoexistenceSnapshot? = null

    fun applyMode(mode: SettingsPrefs.AudioCoexistenceMode) {
        if (mode != SettingsPrefs.AudioCoexistenceMode.Partial) {
            stateMachine.setMode(mode, cjActive = false, playbackActive = isPlaybackActive())
            stopObserving()
            emitSnapshot(AudioCoexistenceCommand.None)
            return
        }
        val command = stateMachine.setMode(
            mode = mode,
            cjActive = currentCjActive(mode),
            playbackActive = isPlaybackActive(),
        )
        dispatch(command)
        startObserving()
    }

    fun onPlaybackStarted() {
        if (!observing) return
        updateCjState(dispatchCommand = false)
    }

    /**
     * 本机明确播放可在当前 CJ 持续期间覆盖共存暂停策略。
     * 这里仅变更状态机，不触碰播放器的硬暂停代次或异步取链任务。
     */
    fun onManualPlayRequested() {
        stateMachine.onManualPlayRequested()
        emitSnapshot(AudioCoexistenceCommand.None)
    }

    fun onPlayWhenReadyChanged(playWhenReady: Boolean): AudioCoexistencePauseDisposition =
        stateMachine.onPlayWhenReadyChanged(playWhenReady)

    fun cancelPendingResume() {
        stateMachine.cancelPendingResume()
    }

    fun release() {
        stateMachine.reset()
        stopObserving()
    }

    private fun startObserving() {
        if (observing) {
            updateCjState()
            return
        }
        val session = ++observationSession
        observing = true
        val currentPlaybackCallback = createPlaybackCallback(session)
        val currentRecordingCallback = createRecordingCallback(session)
        playbackCallback = currentPlaybackCallback
        recordingCallback = currentRecordingCallback
        runCatching { audioManager.registerAudioPlaybackCallback(currentPlaybackCallback, mainHandler) }
        runCatching { audioManager.registerAudioRecordingCallback(currentRecordingCallback, mainHandler) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            modeChangeObserver = ModeChangeObserver(
                audioManager = audioManager,
                executor = Executor { command -> mainHandler.post(command) },
                onModeChanged = { mode ->
                    if (isCurrentObservation(session)) {
                        updateCommunicationMode(mode)
                    }
                },
            ).also { observer -> runCatching { observer.start() } }
        } else {
            legacyModePoll = createLegacyModePoll(session).also(mainHandler::post)
        }
        refreshActiveConfigurations(session, currentPlaybackCallback, currentRecordingCallback)
        if (isCurrentObservation(session)) {
            updateCommunicationMode(audioManager.mode)
        }
    }

    private fun stopObserving() {
        val wasObserving = observing
        ++observationSession
        observing = false
        legacyModePoll?.let(mainHandler::removeCallbacks)
        legacyModePoll = null
        val currentPlaybackCallback = playbackCallback
        val currentRecordingCallback = recordingCallback
        playbackCallback = null
        recordingCallback = null
        val currentModeChangeObserver = modeChangeObserver
        modeChangeObserver = null
        if (wasObserving) {
            currentPlaybackCallback?.let { callback ->
                runCatching { audioManager.unregisterAudioPlaybackCallback(callback) }
            }
            currentRecordingCallback?.let { callback ->
                runCatching { audioManager.unregisterAudioRecordingCallback(callback) }
            }
        }
        if (wasObserving && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            currentModeChangeObserver?.let { observer -> runCatching { observer.stop() } }
        }
        communicationPlaybackActive = false
        recordingActive = false
        communicationModeActive = false
        lastSnapshot = null
    }

    private fun createPlaybackCallback(session: Long) = object : AudioManager.AudioPlaybackCallback() {
        override fun onPlaybackConfigChanged(configs: List<AudioPlaybackConfiguration>) {
            if (!isCurrentObservation(session)) return
            // 公开回调已只含活跃配置；UID 会匿名化，不能据此识别外部播放器。
            communicationPlaybackActive = configs.any { config ->
                AudioInterruptionClassifier.isCommunicationUsage(config.audioAttributes.usage)
            }
            updateCjState()
        }
    }

    private fun createRecordingCallback(session: Long) = object : AudioManager.AudioRecordingCallback() {
        override fun onRecordingConfigChanged(configs: List<AudioRecordingConfiguration>) {
            if (!isCurrentObservation(session)) return
            recordingActive = configs.any { config ->
                AudioInterruptionClassifier.isBlockingRecording(
                    source = config.audioSource,
                    clientSilenced = config.isClientSilenced,
                )
            }
            updateCjState()
        }
    }

    private fun createLegacyModePoll(session: Long) = object : Runnable {
        override fun run() {
            if (!isCurrentObservation(session) || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return
            updateCommunicationMode(audioManager.mode)
            if (isCurrentObservation(session)) {
                mainHandler.postDelayed(this, LEGACY_MODE_POLL_INTERVAL_MS)
            }
        }
    }

    private fun refreshActiveConfigurations(
        session: Long,
        currentPlaybackCallback: AudioManager.AudioPlaybackCallback,
        currentRecordingCallback: AudioManager.AudioRecordingCallback,
    ) {
        runCatching { audioManager.activePlaybackConfigurations }
            .onSuccess { configs ->
                if (isCurrentObservation(session)) {
                    currentPlaybackCallback.onPlaybackConfigChanged(configs)
                }
            }
        runCatching { audioManager.activeRecordingConfigurations }
            .onSuccess { configs ->
                if (isCurrentObservation(session)) {
                    currentRecordingCallback.onRecordingConfigChanged(configs)
                }
            }
    }

    private fun isCurrentObservation(session: Long): Boolean = observing && observationSession == session

    private fun updateCommunicationMode(mode: Int) {
        communicationModeActive = AudioInterruptionClassifier.isCommunicationMode(mode)
        updateCjState()
    }

    private fun updateCjState(dispatchCommand: Boolean = true) {
        if (!observing) return
        val command = stateMachine.updateCj(
            cjActive = currentCjActive(stateMachine.currentMode),
            playbackActive = isPlaybackActive(),
        )
        if (dispatchCommand) {
            dispatch(command)
        } else {
            emitSnapshot(AudioCoexistenceCommand.None)
        }
    }

    private fun dispatch(command: AudioCoexistenceCommand) {
        emitSnapshot(command)
        emitSnapshot(command)
        when (command) {
            AudioCoexistenceCommand.None -> Unit
            AudioCoexistenceCommand.Pause -> pausePlayback()
            AudioCoexistenceCommand.Resume -> resumePlayback()
        }
    }

    private fun emitSnapshot(command: AudioCoexistenceCommand) {
        val snapshot = AudioCoexistenceSnapshot(
            communicationPlaybackActive = communicationPlaybackActive,
            // 保留诊断字段兼容；公开 API 无法可靠识别普通媒体配置是否属于其他应用。
            foreignMediaPlaybackActive = false,
            recordingActive = recordingActive,
            communicationModeActive = communicationModeActive,
            blocking = stateMachine.isCjActive,
            cjActive = stateMachine.isCjActive,
            manualPlayOverrideActive = stateMachine.isManualPlayOverrideActive,
            mode = stateMachine.currentMode,
            command = command,
        )
        if (snapshot == lastSnapshot) return
        lastSnapshot = snapshot
        onSnapshotChanged(snapshot)
    }

    private fun currentCjActive(mode: SettingsPrefs.AudioCoexistenceMode): Boolean =
        AudioInterruptionClassifier.isCjActive(
            mode = mode,
            communicationPlaybackActive = communicationPlaybackActive,
            recordingActive = recordingActive,
            communicationModeActive = communicationModeActive,
        )

    private companion object {
        private const val LEGACY_MODE_POLL_INTERVAL_MS = 1_000L
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private class ModeChangeObserver(
        private val audioManager: AudioManager,
        private val executor: Executor,
        private val onModeChanged: (Int) -> Unit,
    ) {
        private val listener = AudioManager.OnModeChangedListener(onModeChanged)

        fun start() {
            audioManager.addOnModeChangedListener(executor, listener)
        }

        fun stop() {
            audioManager.removeOnModeChangedListener(listener)
        }
    }
}
