package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Test

class LocalPlaylistSongManagementRulesTest {

    @Test
    fun emptyQueryCreatesAFortyItemFirstWindow() {
        val songs = (1..85).map { song(it.toString(), "Song $it") }

        assertEquals(40, playlistSongWindow(filterPlaylistSongs(songs, ""), shown = 0).size)
    }

    @Test
    fun laterWindowAddsAnotherFortyItems() {
        val songs = (1..85).map { song(it.toString(), "Song $it") }

        assertEquals(80, playlistSongWindow(filterPlaylistSongs(songs, ""), shown = 40).size)
        assertEquals(85, playlistSongWindow(filterPlaylistSongs(songs, ""), shown = 80).size)
    }

    @Test
    fun filterMatchesNameAndArtistIgnoringCase() {
        val source = listOf(
            song("1", "Ambient Light", "Artist A"),
            song("2", "Focus", "AMBIENT Beats"),
            song("3", "Workout", "Gym Artist"),
        )

        val filtered = filterPlaylistSongs(source, "ambient")
        assertEquals(listOf("1", "2"), filtered.map { it.id })
    }

    @Test
    fun filterDoesNotMutateSourceOrderOrContent() {
        val source = mutableListOf(
            song("1", "Ambient"),
            song("2", "Focus"),
            song("3", "Ambient 2"),
        )
        val original = source.toList()

        filterPlaylistSongs(source, "ambient")

        assertEquals(original, source)
    }

    @Test
    fun selectAllOnlyAddsFilteredSongsAndKeepsHiddenSelections() {
        val source = listOf(
            song("1", "Ambient"),
            song("2", "Focus"),
            song("3", "Ambient 2"),
        )
        val filtered = filterPlaylistSongs(source, "ambient")
        val initialSelected = setOf(playlistSongKey(source[1])) // "Focus" selected but not in filtered

        val result = selectAllPlaylistSongs(filtered, initialSelected)

        assertEquals(
            setOf(playlistSongKey(source[0]), playlistSongKey(source[1]), playlistSongKey(source[2])),
            result,
        )
    }

    @Test
    fun invertChangesOnlyFilteredSongs() {
        val source = listOf(
            song("1", "Ambient"),
            song("2", "Focus"),
            song("3", "Ambient 2"),
        )
        val filtered = filterPlaylistSongs(source, "ambient")
        val initialSelected = setOf(playlistSongKey(source[0]), playlistSongKey(source[1]))

        val result = invertPlaylistSongs(filtered, initialSelected)

        // 1 was selected and in filter -> unselected
        // 2 was selected and NOT in filter -> kept
        // 3 was not selected and in filter -> selected
        assertEquals(
            setOf(playlistSongKey(source[1]), playlistSongKey(source[2])),
            result,
        )
    }

    @Test
    fun resolveSelectedPlaylistSongsPreservesSourceOrder() {
        val source = listOf(
            song("1", "A"),
            song("2", "B"),
            song("3", "C"),
        )
        val selected = setOf(playlistSongKey(source[2]), playlistSongKey(source[0]))

        val resolved = resolveSelectedPlaylistSongs(source, selected)

        assertEquals(listOf("1", "3"), resolved.map { it.id })
    }

    private fun song(id: String, name: String, artist: String = "Artist") =
        SongInfo(id, SongType.LOCAL, name, artist, "")
}
