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

    private fun song(id: String, playable: Boolean = true) = SongInfo(
        id = id,
        type = SongType.KG,
        name = id,
        artist = "artist",
        coverUrl = "",
        playable = playable,
    )
}
