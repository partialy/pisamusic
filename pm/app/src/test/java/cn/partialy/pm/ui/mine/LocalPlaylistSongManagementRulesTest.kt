package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Test

class LocalPlaylistSongManagementRulesTest {
    @Test fun filtersTitleAndArtistAndWindowsByForty() {
        val songs = (1..45).map { song(it.toString(), "Focus") }
        assertEquals(40, playlistSongWindow(filterPlaylistSongs(songs, "focus"), 0).size)
        assertEquals(listOf("41"), filterPlaylistSongs(listOf(song("41", "Other", "Focus")), "focus").map { it.id })
    }

    @Test fun invertOnlyChangesFilteredSongsAndResolveUsesIdentity() {
        val source = listOf(song("a", "Ambient"), song("b", "Focus"), song("c", "Ambient 2"))
        val filtered = filterPlaylistSongs(source, "ambient")
        val selected = invertPlaylistSongs(filtered, setOf(playlistSongKey(source[0]), "LOCAL:\u0000hidden"))
        assertEquals(setOf("LOCAL:\u0000hidden", playlistSongKey(source[2])), selected)
        assertEquals(listOf("c"), resolveSelectedPlaylistSongs(source, selected).map { it.id })
    }

    private fun song(id: String, name: String, artist: String = "Artist") = SongInfo(id, SongType.LOCAL, name, artist, "")
}
