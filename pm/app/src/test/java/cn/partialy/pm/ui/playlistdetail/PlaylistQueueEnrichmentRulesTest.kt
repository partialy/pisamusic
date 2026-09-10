package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Test

class PlaylistQueueEnrichmentRulesTest {

    @Test
    fun queueCompletionUsesIdentitiesInsteadOfRawOffsets() {
        val queued = listOf(song("2"))
        val loaded = listOf(song("1", playable = false), song("2"), song("3"))

        assertEquals(listOf(song("3")), missingPlayableSongs(loaded, queued))
    }

    @Test
    fun aLoadedSecondPageContributesOnlyNewPlayableSongs() {
        val first = (1..30).map { song("wy", it.toString()) }

        assertEquals(
            listOf(song("wy", "31")),
            missingPlayableSongs(first + song("wy", "31"), first),
        )
    }

    private fun song(source: String, id: String, playable: Boolean = true) = song(
        id = id,
        playable = playable,
        type = SongType.valueOf(source.uppercase()),
    )

    private fun song(
        id: String,
        playable: Boolean = true,
        type: SongType = SongType.KG,
    ) = SongInfo(
        id = id,
        type = type,
        name = id,
        artist = "artist",
        coverUrl = "",
        playable = playable,
    )
}
