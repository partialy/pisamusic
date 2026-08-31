package cn.partialy.pm.listening

import androidx.media3.common.Player
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.MusicController
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import javax.inject.Inject
import javax.inject.Singleton

data class PlaybackObservation(
    val track: ListeningTrack?,
    val isPlaying: Boolean,
    val terminalReason: String?,
)

@Singleton
class Media3ListeningAdapter @Inject constructor(
    private val musicController: MusicController,
) {
    val observations: Flow<PlaybackObservation> = combine(
        musicController.currentSong,
        musicController.isPlaying,
        musicController.playbackState,
    ) { song, playing, state ->
        PlaybackObservation(song?.toListeningTrack(), playing, if (state == Player.STATE_ENDED) "natural_end" else null)
    }.distinctUntilChanged()

    private fun SongInfo.toListeningTrack(): ListeningTrack = ListeningTrack(
        source = type.name.lowercase(),
        songId = id,
        title = name,
        artist = artist,
        album = album,
        trackDurationMs = duration?.toLong()?.takeIf { it > 0 }?.let { it * 1000L },
    )
}
