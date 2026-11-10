package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistBatchDownloadPlannerTest {

    @Test
    fun groupsFollowFirstSourceOccurrenceAndPreserveOrder() {
        val songs = listOf(
            song("w1", SongType.WY),
            song("k1", SongType.KG),
            song("w2", SongType.WY),
            song("c1", SongType.CLOUD),
            song("k2", SongType.KG),
            song("x1", SongType.KW),
        )
        val plan = planPlaylistBatchDownload(songs)
        assertEquals(listOf(SongType.WY, SongType.KG, SongType.CLOUD, SongType.KW),
            plan.groups.map { it.first().type })
        assertEquals(listOf("w1", "w2"), plan.groups[0].map { it.id })
        assertEquals(listOf("k1", "k2"), plan.groups[1].map { it.id })
    }

    @Test
    fun skipsLocalAndUnplayableButKeepsSourceIdentity() {
        val songs = listOf(
            song("1", SongType.KG),
            song("1", SongType.WY),
            song("1", SongType.LOCAL),
            song("1", SongType.KG), // duplicate
            song("bad", SongType.KW, playable = false),
            song("", SongType.CLOUD),
        )
        val plan = planPlaylistBatchDownload(songs)
        assertEquals(2, plan.validCount)
        assertEquals(1, plan.localSkipped)
        assertEquals(2, plan.unavailableSkipped)
        assertEquals(listOf(SongType.KG, SongType.WY), plan.groups.map { it.first().type })
    }

    @Test
    fun hundredThresholdUsesEligibleCountNotTotalSelection() {
        val songs = (1..90).map { song(it.toString(), SongType.KG) } +
            (1..40).map { song(it.toString(), SongType.LOCAL) } +
            (1..5).map { song("u$it", SongType.WY, playable = false) }
        val plan = planPlaylistBatchDownload(songs)
        assertEquals(90, plan.validCount)
        assertTrue(plan.validCount <= 100)
        assertEquals(40, plan.localSkipped)
        assertEquals(5, plan.unavailableSkipped)
    }

    private fun song(id: String, type: SongType, playable: Boolean = true) =
        SongInfo(id = id, type = type, name = "Song", artist = "Artist", coverUrl = "", playable = playable)
}
