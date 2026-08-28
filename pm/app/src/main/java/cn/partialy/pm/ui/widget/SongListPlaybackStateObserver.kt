package cn.partialy.pm.ui.widget

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.MusicController
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

/** 接收歌曲列表需要展示的统一播放状态。 */
fun interface SongListPlaybackStateTarget {
    fun updatePlaybackState(state: SongListPlaybackState)
}

/**
 * 为歌曲列表统一处理播放状态刷新，只通知旧当前项和新当前项。
 */
class SongListPlaybackStateDelegate(
    private val indexOfSong: (SongInfo) -> Int,
    private val notifyItemChanged: (Int) -> Unit,
) : SongListPlaybackStateTarget {

    var state: SongListPlaybackState = SongListPlaybackState()
        private set

    override fun updatePlaybackState(state: SongListPlaybackState) {
        val previous = this.state
        if (previous == state) return
        this.state = state

        val sameCurrentSong = previous.currentSong.sameIdentityAs(state.currentSong)
        val songsToRefresh = when {
            !sameCurrentSong -> listOfNotNull(previous.currentSong, state.currentSong)
            previous.isPlaying != state.isPlaying -> listOfNotNull(state.currentSong)
            else -> emptyList()
        }
        songsToRefresh
            .map(indexOfSong)
            .filter { it >= 0 }
            .distinct()
            .forEach(notifyItemChanged)
    }

    private fun SongInfo?.sameIdentityAs(other: SongInfo?): Boolean = when {
        this == null || other == null -> this == null && other == null
        else -> type == other.type && id == other.id
    }
}

/**
 * 在宿主处于 STARTED 及以上时观察播放器状态，并将状态分发给当前目标集合。
 *
 * 目标集合在每次状态发出时重新获取，适用于首页动态创建或销毁多个歌曲列表。
 */
fun LifecycleOwner.observeSongListPlaybackState(
    musicController: MusicController,
    targetsProvider: () -> Iterable<SongListPlaybackStateTarget>,
): Job = lifecycleScope.launch {
    repeatOnLifecycle(Lifecycle.State.STARTED) {
        musicController.currentSong
            .combine(musicController.isPlaying) { currentSong, isPlaying ->
                SongListPlaybackState(currentSong = currentSong, isPlaying = isPlaying)
            }
            .distinctUntilChanged()
            .collect { state ->
                targetsProvider().forEach { target ->
                    target.updatePlaybackState(state)
                }
            }
    }
}

/** 单个歌曲列表目标的便捷调用入口。 */
fun LifecycleOwner.observeSongListPlaybackState(
    musicController: MusicController,
    target: SongListPlaybackStateTarget,
): Job = observeSongListPlaybackState(musicController) { listOf(target) }
