package cn.partialy.pm.player

import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi

@UnstableApi
internal class PlaybackIntentForwardingPlayer(
    player: Player,
    private val onPlayRequested: () -> Unit,
    private val onPauseRequested: () -> Unit,
) : ForwardingPlayer(player) {

    override fun play() {
        onPlayRequested()
        super.play()
    }

    override fun pause() {
        onPauseRequested()
        super.pause()
    }

    override fun setPlayWhenReady(playWhenReady: Boolean) {
        if (playWhenReady) {
            onPlayRequested()
        } else {
            onPauseRequested()
        }
        super.setPlayWhenReady(playWhenReady)
    }
}
