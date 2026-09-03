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
import android.os.Process
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

        val previousMode = this.mode
        this.mode = mode
        if (!modeRequiresPause()) {
            clearState()
            return AudioCoexistenceCommand.None
        }

        if (previousMode == SettingsPrefs.AudioCoexistenceMode.All) {
            clearState()
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
            return AudioCoexistenceCommand.Pause
        }
        if (!cjExited) return AudioCoexistenceCommand.None

        manualPlayOverrideActive = false
        val shouldResume = resumeWhenClear && !awaitingOwnPauseCallback
        resumeWhenClear = false
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

    // Task 2 will replace the controller call sites with the explicit CJ API.
    fun setPartialEnabled(enabled: Boolean, playbackActive: Boolean): AudioCoexistenceCommand =
        setMode(
            mode = if (enabled) SettingsPrefs.AudioCoexistenceMode.Partial else SettingsPrefs.AudioCoexistenceMode.All,
            cjActive = cjActive,
            playbackActive = playbackActive,
        )

    fun updateBlocking(isBlocking: Boolean, playbackActive: Boolean): AudioCoexistenceCommand =
        updateCj(cjActive = isBlocking, playbackActive = playbackActive)

    private fun modeRequiresPause(): Boolean = mode != SettingsPrefs.AudioCoexistenceMode.All

    private fun clearState() {
        cjActive = false
        manualPlayOverrideActive = false
        resumeWhenClear = false
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
        foreignMediaPlaybackActive: Boolean,
        recordingActive: Boolean,
        communicationModeActive: Boolean,
    ): Boolean {
        val partialCjActive = communicationPlaybackActive || recordingActive || communicationModeActive
        return when (mode) {
            SettingsPrefs.AudioCoexistenceMode.All -> false
            SettingsPrefs.AudioCoexistenceMode.Partial -> partialCjActive
            SettingsPrefs.AudioCoexistenceMode.Off -> partialCjActive || foreignMediaPlaybackActive
        }
    }
}

internal class AudioCoexistenceController(
    context: Context,
    private val isPlaybackActive: () -> Boolean,
    private val pausePlayback: () -> Unit,
    private val resumePlayback: () -> Unit,
    private val onSnapshotChanged: (AudioCoexistenceSnapshot) -> Unit = {},
) {
    private val audioManager = context.applicationContext
        .getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private val stateMachine = AudioCoexistenceStateMachine()
    private var observing = false
    private var communicationPlaybackActive = false
    private var foreignMediaPlaybackActive = false
    private var recordingActive = false
    private var communicationModeActive = false
    private var modeChangeObserver: ModeChangeObserver? = null
    private var lastSnapshot: AudioCoexistenceSnapshot? = null

    private val playbackCallback = object : AudioManager.AudioPlaybackCallback() {
        override fun onPlaybackConfigChanged(configs: List<AudioPlaybackConfiguration>) {
            val activeExternalConfigs = configs.filter { config ->
                config.isActiveExternalPlayback()
            }
            communicationPlaybackActive = activeExternalConfigs.any { config ->
                AudioInterruptionClassifier.isCommunicationUsage(config.audioAttributes.usage)
            }
            foreignMediaPlaybackActive = activeExternalConfigs.any { config ->
                !AudioInterruptionClassifier.isCommunicationUsage(config.audioAttributes.usage)
            }
            updateCjState()
        }
    }

    private val recordingCallback = object : AudioManager.AudioRecordingCallback() {
        override fun onRecordingConfigChanged(configs: List<AudioRecordingConfiguration>) {
            recordingActive = configs.any { config ->
                AudioInterruptionClassifier.isBlockingRecording(
                    source = config.audioSource,
                    clientSilenced = config.isClientSilenced,
                )
            }
            updateCjState()
        }
    }

    private val legacyModePoll = object : Runnable {
        override fun run() {
            if (!observing || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return
            updateCommunicationMode(audioManager.mode)
            mainHandler.postDelayed(this, LEGACY_MODE_POLL_INTERVAL_MS)
        }
    }

    fun applyMode(mode: SettingsPrefs.AudioCoexistenceMode) {
        if (mode == SettingsPrefs.AudioCoexistenceMode.All) {
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
        observing = true
        runCatching { audioManager.registerAudioPlaybackCallback(playbackCallback, mainHandler) }
        runCatching { audioManager.registerAudioRecordingCallback(recordingCallback, mainHandler) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            modeChangeObserver = ModeChangeObserver(
                audioManager = audioManager,
                executor = Executor { command -> mainHandler.post(command) },
                onModeChanged = ::updateCommunicationMode,
            ).also { observer -> runCatching { observer.start() } }
        } else {
            mainHandler.post(legacyModePoll)
        }
        refreshActiveConfigurations()
        updateCommunicationMode(audioManager.mode)
    }

    private fun stopObserving() {
        val wasObserving = observing
        observing = false
        mainHandler.removeCallbacks(legacyModePoll)
        if (wasObserving) {
            runCatching { audioManager.unregisterAudioPlaybackCallback(playbackCallback) }
            runCatching { audioManager.unregisterAudioRecordingCallback(recordingCallback) }
        }
        if (wasObserving && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            modeChangeObserver?.let { observer -> runCatching { observer.stop() } }
        }
        modeChangeObserver = null
        communicationPlaybackActive = false
        foreignMediaPlaybackActive = false
        recordingActive = false
        communicationModeActive = false
        lastSnapshot = null
    }

    private fun refreshActiveConfigurations() {
        runCatching { audioManager.activePlaybackConfigurations }
            .onSuccess { playbackCallback.onPlaybackConfigChanged(it) }
        runCatching { audioManager.activeRecordingConfigurations }
            .onSuccess { recordingCallback.onRecordingConfigChanged(it) }
    }

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
        when (command) {
            AudioCoexistenceCommand.None -> Unit
            AudioCoexistenceCommand.Pause -> pausePlayback()
            AudioCoexistenceCommand.Resume -> resumePlayback()
        }
    }

    private fun emitSnapshot(command: AudioCoexistenceCommand) {
        val snapshot = AudioCoexistenceSnapshot(
            communicationPlaybackActive = communicationPlaybackActive,
            foreignMediaPlaybackActive = foreignMediaPlaybackActive,
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
            foreignMediaPlaybackActive = foreignMediaPlaybackActive,
            recordingActive = recordingActive,
            communicationModeActive = communicationModeActive,
        )

    /**
     * 部分公开 SDK 存根未暴露配置归属和活跃状态，但 Android 运行时回调对象提供这两个属性。
     * 读取失败时保守地不把该配置认定为外部 CJ，避免误暂停当前播放。
     */
    private fun AudioPlaybackConfiguration.isActiveExternalPlayback(): Boolean {
        val active = runCatching {
            javaClass.getMethod("isActive").invoke(this) as Boolean
        }.getOrDefault(false)
        val clientUid = runCatching {
            javaClass.getMethod("getClientUid").invoke(this) as Int
        }.getOrNull()
        return active && clientUid != null && clientUid != Process.myUid()
    }

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
