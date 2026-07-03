package cn.partialy.pm.player

import cn.partialy.pm.audioeffect.AudioEffectState
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AudioRendererPolicyTest {
    @Test
    fun `default audio state uses native renderer`() {
        assertFalse(AudioRendererPolicy.shouldUseAudioEffectsRenderer(AudioEffectState()))
    }

    @Test
    fun `eq only state keeps native renderer`() {
        assertFalse(
            AudioRendererPolicy.shouldUseAudioEffectsRenderer(
                AudioEffectState(enabled = true, bass = 70),
            ),
        )
    }

    @Test
    fun `stereo widening uses audio effects renderer`() {
        assertTrue(
            AudioRendererPolicy.shouldUseAudioEffectsRenderer(
                AudioEffectState(enabled = true, stereoWidth = 140),
            ),
        )
    }

    @Test
    fun `audio processor stack is treated as audio renderer error`() {
        val stackTrace = """
            java.lang.IllegalArgumentException: The source buffer is this buffer
                at cn.partialy.pm.audioeffect.StereoWidenerAudioProcessor.queueInput(Unknown Source:164)
                at androidx.media3.exoplayer.audio.DefaultAudioSink.processBuffers(Unknown Source:37)
        """.trimIndent()

        assertTrue(
            AudioRendererPolicy.hasAudioRendererHint(listOf(stackTrace)),
        )
    }
}
