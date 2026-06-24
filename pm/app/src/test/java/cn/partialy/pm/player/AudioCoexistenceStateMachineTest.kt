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
    fun `active playback pauses for blocker and resumes when blocker clears`() {
        val state = AudioCoexistenceStateMachine()

        assertEquals(AudioCoexistenceCommand.None, state.setPartialEnabled(true, playbackActive = true))
        assertEquals(AudioCoexistenceCommand.Pause, state.updateBlocking(true, playbackActive = true))
        assertEquals(AudioCoexistenceCommand.Resume, state.updateBlocking(false, playbackActive = false))
    }

    @Test
    fun `paused playback is not started when blocker clears`() {
        val state = AudioCoexistenceStateMachine()

        state.setPartialEnabled(true, playbackActive = false)
        assertEquals(AudioCoexistenceCommand.None, state.updateBlocking(true, playbackActive = false))
        assertEquals(AudioCoexistenceCommand.None, state.updateBlocking(false, playbackActive = false))
    }

    @Test
    fun `manual pause while blocked cancels automatic resume`() {
        val state = AudioCoexistenceStateMachine()

        state.setPartialEnabled(true, playbackActive = true)
        assertEquals(AudioCoexistenceCommand.Pause, state.updateBlocking(true, playbackActive = true))
        state.onUserPauseRequested()
        assertEquals(AudioCoexistenceCommand.None, state.updateBlocking(false, playbackActive = false))
    }

    @Test
    fun `play attempt while blocked is paused and resumes later`() {
        val state = AudioCoexistenceStateMachine()

        state.setPartialEnabled(true, playbackActive = false)
        state.updateBlocking(true, playbackActive = false)
        assertEquals(AudioCoexistenceCommand.Pause, state.updateBlocking(true, playbackActive = true))
        assertEquals(AudioCoexistenceCommand.Resume, state.updateBlocking(false, playbackActive = false))
    }

    @Test
    fun `communication and recording classifiers exclude normal media and silenced capture`() {
        assertTrue(AudioInterruptionClassifier.isCommunicationUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION))
        assertFalse(AudioInterruptionClassifier.isCommunicationUsage(AudioAttributes.USAGE_MEDIA))
        assertTrue(
            AudioInterruptionClassifier.isBlockingRecording(
                MediaRecorder.AudioSource.MIC,
                clientSilenced = false,
            ),
        )
        assertFalse(
            AudioInterruptionClassifier.isBlockingRecording(
                MediaRecorder.AudioSource.MIC,
                clientSilenced = true,
            ),
        )
        assertTrue(AudioInterruptionClassifier.isCommunicationMode(AudioManager.MODE_IN_COMMUNICATION))
        assertFalse(AudioInterruptionClassifier.isCommunicationMode(AudioManager.MODE_NORMAL))
    }

    @Test
    fun `preference values round trip and unknown value falls back to off`() {
        SettingsPrefs.AudioCoexistenceMode.values().forEach { mode ->
            assertEquals(mode, SettingsPrefs.AudioCoexistenceMode.fromPrefValue(mode.prefValue))
        }
        assertEquals(
            SettingsPrefs.AudioCoexistenceMode.Off,
            SettingsPrefs.AudioCoexistenceMode.fromPrefValue(Int.MAX_VALUE),
        )
    }

    @Test
    fun `reset clears pending resume during player release`() {
        val state = AudioCoexistenceStateMachine()

        state.setPartialEnabled(true, playbackActive = true)
        state.updateBlocking(true, playbackActive = true)
        state.reset()

        assertEquals(AudioCoexistenceCommand.None, state.setPartialEnabled(false, playbackActive = false))
    }
}
