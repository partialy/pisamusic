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

    @Test
    fun resolveDynamicBatchSizeCalculatesCorrectBounds() {
        // <= 0 or tiny playlists -> 50
        assertEquals(50, resolveDynamicBatchSize(0))
        assertEquals(50, resolveDynamicBatchSize(-10))
        assertEquals(50, resolveDynamicBatchSize(20))
        assertEquals(50, resolveDynamicBatchSize(60)) // (60 + 2) / 3 = 20 -> coerce to 50
        assertEquals(50, resolveDynamicBatchSize(150)) // (150 + 2) / 3 = 50

        // normal playlists -> dynamic (around 3 batches)
        assertEquals(101, resolveDynamicBatchSize(301)) // (301 + 2) / 3 = 101
        assertEquals(134, resolveDynamicBatchSize(400)) // (400 + 2) / 3 = 134
        assertEquals(200, resolveDynamicBatchSize(598)) // (598 + 2) / 3 = 200

        // massive playlists -> capped at 200
        assertEquals(200, resolveDynamicBatchSize(600))
        assertEquals(200, resolveDynamicBatchSize(1000))
        assertEquals(200, resolveDynamicBatchSize(5000))
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
