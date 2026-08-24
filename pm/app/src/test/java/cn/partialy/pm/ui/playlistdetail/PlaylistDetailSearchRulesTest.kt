package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistDetailSearchRulesTest {
    private val songs = listOf(
        song(id = "1", name = "晴天", artist = "周杰伦"),
        song(id = "2", name = "夜曲", artist = "Jay Chou"),
        song(id = "3", name = "海阔天空", artist = "Beyond"),
    )

    @Test
    fun blankQueryReturnsAllRowsWithOriginalIndexes() {
        assertEquals(listOf(0, 1, 2), filterPlaylistSongRows(songs, "  ").map { it.originalIndex })
    }

    @Test
    fun filtersBySongNameAndTrimsQuery() {
        val rows = filterPlaylistSongRows(songs, "  夜曲 ")
        assertEquals(listOf("2"), rows.map { it.song.id })
        assertEquals(listOf(1), rows.map { it.originalIndex })
    }

    @Test
    fun filtersArtistIgnoringCase() {
        assertEquals(listOf("2"), filterPlaylistSongRows(songs, "jay chou").map { it.song.id })
    }

    @Test
    fun noMatchReturnsEmptyRows() {
        assertTrue(filterPlaylistSongRows(songs, "不存在").isEmpty())
    }

    private fun song(id: String, name: String, artist: String) = SongInfo(
        id = id,
        type = SongType.KG,
        name = name,
        artist = artist,
        coverUrl = "",
    )
}
