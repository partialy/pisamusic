package cn.partialy.pm.player

import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaRecorder
import cn.partialy.pm.utils.SettingsPrefs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AudioCoexistenceStateMachineTest {
    @Test
    fun `manual play during an existing CJ is not paused until CJ re-enters`() {
        val state = AudioCoexistenceStateMachine()

        state.setMode(SettingsPrefs.AudioCoexistenceMode.Partial, cjActive = false, playbackActive = true)
        assertEquals(AudioCoexistenceCommand.Pause, state.updateCj(cjActive = true, playbackActive = true))
        state.onManualPlayRequested()
        assertEquals(AudioCoexistenceCommand.None, state.updateCj(cjActive = true, playbackActive = true))
        assertEquals(AudioCoexistenceCommand.None, state.updateCj(cjActive = false, playbackActive = true))
        assertEquals(AudioCoexistenceCommand.Pause, state.updateCj(cjActive = true, playbackActive = true))
    }

    @Test
    fun `off mode leaves policy commands and manual priority to platform focus`() {
        val state = AudioCoexistenceStateMachine()

        state.setMode(SettingsPrefs.AudioCoexistenceMode.Off, cjActive = false, playbackActive = true)
        assertEquals(AudioCoexistenceCommand.None, state.updateCj(cjActive = true, playbackActive = true))
        state.onManualPlayRequested()
        assertEquals(AudioCoexistenceCommand.None, state.updateCj(cjActive = true, playbackActive = true))
        assertEquals(AudioCoexistenceCommand.None, state.updateCj(cjActive = false, playbackActive = true))
        assertEquals(AudioCoexistenceCommand.None, state.updateCj(cjActive = true, playbackActive = true))
        assertEquals(SettingsPrefs.AudioCoexistenceMode.Off, state.currentMode)
        assertFalse(state.isCjActive)
        assertFalse(state.isManualPlayOverrideActive)
    }

    @Test
    fun `only partial mode treats communication and capture as a policy CJ`() {
        SettingsPrefs.AudioCoexistenceMode.values().forEach { mode ->
            assertEquals(
                mode == SettingsPrefs.AudioCoexistenceMode.Partial,
                AudioInterruptionClassifier.isCjActive(
                    mode = mode,
                    communicationPlaybackActive = true,
                    recordingActive = true,
                    communicationModeActive = true,
                ),
            )
        }
        assertFalse(
            AudioInterruptionClassifier.isCjActive(
                mode = SettingsPrefs.AudioCoexistenceMode.Partial,
                communicationPlaybackActive = false,
                recordingActive = false,
                communicationModeActive = false,
            ),
        )
    }

    @Test
    fun `all mode never pauses`() {
        val state = AudioCoexistenceStateMachine()

        state.setMode(SettingsPrefs.AudioCoexistenceMode.All, cjActive = false, playbackActive = true)
        assertEquals(AudioCoexistenceCommand.None, state.updateCj(cjActive = true, playbackActive = true))
    }

    @Test
    fun `leaving partial clears its pause and override without issuing resume`() {
        listOf(SettingsPrefs.AudioCoexistenceMode.Off, SettingsPrefs.AudioCoexistenceMode.All).forEach { mode ->
            listOf(false, true).forEach { manualOverride ->
                val state = AudioCoexistenceStateMachine()
                state.setMode(SettingsPrefs.AudioCoexistenceMode.Partial, cjActive = true, playbackActive = true)
                state.onPlayWhenReadyChanged(false)
                if (manualOverride) state.onManualPlayRequested()

                assertEquals(
                    AudioCoexistenceCommand.None,
                    state.setMode(mode, cjActive = true, playbackActive = manualOverride),
                )
                assertEquals(mode, state.currentMode)
                assertFalse(state.isCjActive)
                assertFalse(state.isManualPlayOverrideActive)
                assertEquals(AudioCoexistenceCommand.None, state.updateCj(cjActive = false, playbackActive = false))
                assertEquals(AudioCoexistencePauseDisposition.NONE, state.onPlayWhenReadyChanged(false))
            }
        }
    }

    @Test
    fun `user and external pauses cancel automatic resume`() {
        val userPauseState = AudioCoexistenceStateMachine()
        userPauseState.setMode(SettingsPrefs.AudioCoexistenceMode.Partial, cjActive = false, playbackActive = true)
        assertEquals(AudioCoexistenceCommand.Pause, userPauseState.updateCj(cjActive = true, playbackActive = true))
        userPauseState.cancelPendingResume()
        assertEquals(AudioCoexistenceCommand.None, userPauseState.updateCj(cjActive = false, playbackActive = false))

        val externalPauseState = AudioCoexistenceStateMachine()
        externalPauseState.setMode(SettingsPrefs.AudioCoexistenceMode.Partial, cjActive = false, playbackActive = true)
        assertEquals(AudioCoexistenceCommand.Pause, externalPauseState.updateCj(cjActive = true, playbackActive = true))
        assertEquals(AudioCoexistencePauseDisposition.OWN_PAUSE_OBSERVED, externalPauseState.onPlayWhenReadyChanged(false))
        assertEquals(AudioCoexistencePauseDisposition.EXTERNAL_PAUSE_CANCELLED_RESUME, externalPauseState.onPlayWhenReadyChanged(false))
        assertEquals(AudioCoexistenceCommand.None, externalPauseState.updateCj(cjActive = false, playbackActive = false))
    }

    @Test
    fun `policy pause callback only confirms the matching policy pause`() {
        val unconfirmedState = AudioCoexistenceStateMachine()
        unconfirmedState.setMode(SettingsPrefs.AudioCoexistenceMode.Partial, cjActive = false, playbackActive = true)
        assertEquals(AudioCoexistenceCommand.Pause, unconfirmedState.updateCj(cjActive = true, playbackActive = true))
        assertEquals(AudioCoexistenceCommand.None, unconfirmedState.updateCj(cjActive = false, playbackActive = false))

        val state = AudioCoexistenceStateMachine()

        state.setMode(SettingsPrefs.AudioCoexistenceMode.Partial, cjActive = false, playbackActive = true)
        assertEquals(AudioCoexistenceCommand.Pause, state.updateCj(cjActive = true, playbackActive = true))
        assertEquals(AudioCoexistencePauseDisposition.OWN_PAUSE_OBSERVED, state.onPlayWhenReadyChanged(false))
        assertEquals(AudioCoexistenceCommand.Resume, state.updateCj(cjActive = false, playbackActive = false))
    }

    @Test
    fun `switching from all evaluates an active CJ as a new policy activation`() {
        val state = AudioCoexistenceStateMachine()

        state.setMode(SettingsPrefs.AudioCoexistenceMode.All, cjActive = true, playbackActive = true)
        assertEquals(
            AudioCoexistenceCommand.Pause,
            state.setMode(SettingsPrefs.AudioCoexistenceMode.Partial, cjActive = true, playbackActive = true),
        )
    }

    @Test
    fun `reset clears all state`() {
        val state = AudioCoexistenceStateMachine()

        state.setMode(SettingsPrefs.AudioCoexistenceMode.Partial, cjActive = false, playbackActive = true)
        state.updateCj(cjActive = true, playbackActive = true)
        state.onManualPlayRequested()
        state.reset()

        assertEquals(SettingsPrefs.AudioCoexistenceMode.All, state.currentMode)
        assertFalse(state.isCjActive)
        assertFalse(state.isManualPlayOverrideActive)
        assertEquals(
            AudioCoexistenceCommand.Pause,
            state.setMode(SettingsPrefs.AudioCoexistenceMode.Partial, cjActive = true, playbackActive = true),
        )
    }

    @Test
    fun `communication and recording classifiers distinguish media remote submix and silenced capture`() {
        assertTrue(AudioInterruptionClassifier.isCommunicationUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION))
        assertFalse(AudioInterruptionClassifier.isCommunicationUsage(AudioAttributes.USAGE_MEDIA))
        assertTrue(
            AudioInterruptionClassifier.isBlockingRecording(
                MediaRecorder.AudioSource.MIC,
                clientSilenced = false,
            ),
        )
        assertTrue(
            AudioInterruptionClassifier.isBlockingRecording(
                MediaRecorder.AudioSource.REMOTE_SUBMIX,
                clientSilenced = false,
            ),
        )
        assertFalse(
            AudioInterruptionClassifier.isBlockingRecording(MediaRecorder.AudioSource.MIC, clientSilenced = true))
        assertTrue(AudioInterruptionClassifier.isCommunicationMode(AudioManager.MODE_IN_COMMUNICATION))
        assertFalse(AudioInterruptionClassifier.isCommunicationMode(AudioManager.MODE_NORMAL))
    }

    @Test
    fun `preference values round trip and unknown value falls back to off`() {
        SettingsPrefs.AudioCoexistenceMode.values().forEach { mode ->
            assertEquals(mode, SettingsPrefs.AudioCoexistenceMode.fromPrefValue(mode.prefValue))
        }
        assertEquals(SettingsPrefs.AudioCoexistenceMode.Off, SettingsPrefs.AudioCoexistenceMode.fromPrefValue(Int.MAX_VALUE))
    }
}
