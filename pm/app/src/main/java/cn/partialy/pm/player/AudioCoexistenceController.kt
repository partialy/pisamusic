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
    val recordingActive: Boolean,
    val communicationModeActive: Boolean,
    val blocking: Boolean,
    val command: AudioCoexistenceCommand,
)

internal class AudioCoexistenceStateMachine {
    private var partialEnabled = false
    private var blocking = false
    private var resumeWhenClear = false
    private var awaitingOwnPauseCallback = false

    fun setPartialEnabled(enabled: Boolean, playbackActive: Boolean): AudioCoexistenceCommand {
        if (partialEnabled == enabled) {
            return if (enabled && blocking && playbackActive) {
                resumeWhenClear = true
                awaitingOwnPauseCallback = true
                AudioCoexistenceCommand.Pause
            } else {
                AudioCoexistenceCommand.None
            }
        }
        partialEnabled = enabled
        if (!enabled) {
            blocking = false
            resumeWhenClear = false
            awaitingOwnPauseCallback = false
            return AudioCoexistenceCommand.None
        }
        return AudioCoexistenceCommand.None
    }

    fun updateBlocking(isBlocking: Boolean, playbackActive: Boolean): AudioCoexistenceCommand {
        if (!partialEnabled) return AudioCoexistenceCommand.None
        if (blocking == isBlocking) {
            return if (isBlocking && playbackActive) {
                resumeWhenClear = true
                awaitingOwnPauseCallback = true
                AudioCoexistenceCommand.Pause
            } else {
                AudioCoexistenceCommand.None
            }
        }
        blocking = isBlocking
        if (isBlocking) {
            if (!playbackActive) return AudioCoexistenceCommand.None
            resumeWhenClear = true
            awaitingOwnPauseCallback = true
            return AudioCoexistenceCommand.Pause
        }
        val shouldResume = resumeWhenClear && !awaitingOwnPauseCallback
        resumeWhenClear = false
        awaitingOwnPauseCallback = false
        return if (shouldResume) AudioCoexistenceCommand.Resume else AudioCoexistenceCommand.None
    }

    fun onPlayWhenReadyChanged(playWhenReady: Boolean): AudioCoexistencePauseDisposition {
        if (!partialEnabled) return AudioCoexistencePauseDisposition.NONE
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
        partialEnabled = false
        blocking = false
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
    private var recordingActive = false
    private var communicationModeActive = false
    private var modeChangeObserver: ModeChangeObserver? = null
    private var lastSnapshot: AudioCoexistenceSnapshot? = null

    private val playbackCallback = object : AudioManager.AudioPlaybackCallback() {
        override fun onPlaybackConfigChanged(configs: List<AudioPlaybackConfiguration>) {
            communicationPlaybackActive = configs.any { config ->
                AudioInterruptionClassifier.isCommunicationUsage(
                    config.audioAttributes.usage,
                )
            }
            updateBlockingState()
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
            updateBlockingState()
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
        val partial = mode == SettingsPrefs.AudioCoexistenceMode.Partial
        val command = stateMachine.setPartialEnabled(partial, isPlaybackActive())
        if (partial) {
            startObserving()
            dispatch(command)
        } else {
            stopObserving()
            emitSnapshot(AudioCoexistenceCommand.None)
        }
    }

    fun onPlaybackStarted() {
        if (!observing) return
        updateBlockingState()
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
            updateBlockingState()
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
        if (!observing) return
        observing = false
        mainHandler.removeCallbacks(legacyModePoll)
        runCatching { audioManager.unregisterAudioPlaybackCallback(playbackCallback) }
        runCatching { audioManager.unregisterAudioRecordingCallback(recordingCallback) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            modeChangeObserver?.let { observer -> runCatching { observer.stop() } }
            modeChangeObserver = null
        }
        communicationPlaybackActive = false
        recordingActive = false
        communicationModeActive = false
        emitSnapshot(AudioCoexistenceCommand.None)
    }

    private fun refreshActiveConfigurations() {
        runCatching { audioManager.activePlaybackConfigurations }
            .onSuccess { playbackCallback.onPlaybackConfigChanged(it) }
        runCatching { audioManager.activeRecordingConfigurations }
            .onSuccess { recordingCallback.onRecordingConfigChanged(it) }
    }

    private fun updateCommunicationMode(mode: Int) {
        communicationModeActive = AudioInterruptionClassifier.isCommunicationMode(mode)
        updateBlockingState()
    }

    private fun updateBlockingState() {
        if (!observing) return
        val command = stateMachine.updateBlocking(
            isBlocking = communicationPlaybackActive || recordingActive || communicationModeActive,
            playbackActive = isPlaybackActive(),
        )
        dispatch(command)
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
            recordingActive = recordingActive,
            communicationModeActive = communicationModeActive,
            blocking = communicationPlaybackActive || recordingActive || communicationModeActive,
            command = command,
        )
        if (snapshot == lastSnapshot) return
        lastSnapshot = snapshot
        onSnapshotChanged(snapshot)
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
