package cn.partialy.pm.ui.message

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.MusicController
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 只为本页最新点击的歌曲，在播放器真正起播后提示一次。 */
class SongPlaybackSuccessNotifier(
    private val owner: LifecycleOwner,
    private val controller: MusicController,
    private val onStarted: (SongInfo) -> Unit,
) : DefaultLifecycleObserver {
    private var clearPending: (() -> Unit)? = null
    private var timeoutJob: Job? = null

    init {
        owner.lifecycle.addObserver(this)
    }

    fun play(song: SongInfo) {
        cancelPending()
        if (!song.playable) return
        val player = controller.exoPlayer ?: return
        val listener = object : Player.Listener {
            override fun onEvents(player: Player, events: Player.Events) {
                val playbackChanged = events.contains(Player.EVENT_IS_PLAYING_CHANGED) ||
                    events.contains(Player.EVENT_MEDIA_ITEM_TRANSITION) ||
                    events.contains(Player.EVENT_POSITION_DISCONTINUITY)
                if (!playbackChanged || !player.isPlaying) return
                val current = controller.currentSong.value
                if (current != null && current.type == song.type && current.id == song.id) {
                    cancelPending()
                    onStarted(song)
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                cancelPending()
            }

            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                if (!playWhenReady) cancelPending()
            }
        }
        player.addListener(listener)
        clearPending = { player.removeListener(listener) }
        // 超时只撤销提示，不干预持续播放任务。
        timeoutJob = owner.lifecycleScope.launch {
            delay(30_000L)
            cancelPending()
        }
        controller.addToPlayList(song, autoPlay = true)
    }

    fun cancelPending() {
        clearPending?.invoke()
        clearPending = null
        timeoutJob?.cancel()
        timeoutJob = null
    }

    override fun onStop(owner: LifecycleOwner) = cancelPending()

    override fun onDestroy(owner: LifecycleOwner) {
        cancelPending()
        owner.lifecycle.removeObserver(this)
    }
}
