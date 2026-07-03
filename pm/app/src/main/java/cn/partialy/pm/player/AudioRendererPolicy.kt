package cn.partialy.pm.player

import androidx.media3.common.PlaybackException
import cn.partialy.pm.audioeffect.AudioEffectState

object AudioRendererPolicy {
    fun shouldUseAudioEffectsRenderer(state: AudioEffectState): Boolean =
        state.toStereoWidenerSettings().requiresAudioProcessor()

    fun isAudioRendererError(error: PlaybackException): Boolean {
        val hints = listOf(
            error.errorCodeName,
            error.cause?.javaClass?.name,
            error.cause?.message,
            error.message,
            error.cause?.stackTraceToString(),
            error.stackTraceToString(),
        )
        return hasAudioRendererHint(hints)
    }

    internal fun hasAudioRendererHint(hints: Iterable<String?>): Boolean =
        hints.any { it?.contains("audio", ignoreCase = true) == true }
}
