package cn.partialy.pm.player.diagnostic

import androidx.media3.common.Player

internal object Media3ReasonNames {
    fun playWhenReady(reason: Int): String = when (reason) {
        Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST -> "user_request"
        Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS -> "audio_focus_loss"
        Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY -> "audio_becoming_noisy"
        Player.PLAY_WHEN_READY_CHANGE_REASON_REMOTE -> "remote"
        Player.PLAY_WHEN_READY_CHANGE_REASON_END_OF_MEDIA_ITEM -> "end_of_media_item"
        Player.PLAY_WHEN_READY_CHANGE_REASON_SUPPRESSED_TOO_LONG -> "suppressed_too_long"
        else -> "unknown_$reason"
    }

    fun playbackState(state: Int): String = when (state) {
        Player.STATE_IDLE -> "idle"
        Player.STATE_BUFFERING -> "buffering"
        Player.STATE_READY -> "ready"
        Player.STATE_ENDED -> "ended"
        else -> "unknown_$state"
    }

    fun suppression(reason: Int): String = when (reason) {
        Player.PLAYBACK_SUPPRESSION_REASON_NONE -> "none"
        Player.PLAYBACK_SUPPRESSION_REASON_TRANSIENT_AUDIO_FOCUS_LOSS -> "transient_audio_focus_loss"
        Player.PLAYBACK_SUPPRESSION_REASON_UNSUITABLE_AUDIO_ROUTE -> "unsuitable_audio_route"
        Player.PLAYBACK_SUPPRESSION_REASON_UNSUITABLE_AUDIO_OUTPUT -> "unsuitable_audio_output"
        else -> "unknown_$reason"
    }
}
