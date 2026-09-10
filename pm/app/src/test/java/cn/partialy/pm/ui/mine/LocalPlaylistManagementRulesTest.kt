package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import org.junit.Assert.assertEquals
import org.junit.Test

class LocalPlaylistManagementRulesTest {

    @Test
    fun emptyQueryCreatesAFortyItemFirstWindow() {
        val source = (1..85).map { localPlaylist(it.toString(), "Playlist $it") }

        assertEquals(40, window(filter(source, ""), shown = 0).size)
    }

    @Test
    fun laterWindowAddsAnotherFortyItems() {
        val source = (1..85).map { localPlaylist(it.toString(), "Playlist $it") }

        assertEquals(80, window(filter(source, ""), shown = 40).size)
        assertEquals(85, window(filter(source, ""), shown = 80).size)
    }

    @Test
    fun filterMatchesNameAndIntroIgnoringCase() {
        val source = listOf(
            localPlaylist("a", "Ambient", "Night sounds"),
            localPlaylist("b", "Focus", "AMBIENT study mix"),
            localPlaylist("c", "Workout", "Gym"),
        )

        assertEquals(setOf("a", "b"), filter(source, "ambient").map { it.id }.toSet())
    }

    @Test
    fun filterDoesNotMutateSourceOrderOrContent() {
        val source = mutableListOf(
            localPlaylist("a", "Ambient"),
            localPlaylist("b", "Focus"),
            localPlaylist("c", "Ambient 2"),
        )
        val original = source.toList()

        filter(source, "ambient")

        assertEquals(original, source)
    }

    @Test
    fun selectAllOnlyAddsFilteredIdsAndKeepsHiddenSelections() {
        val source = listOf(
            localPlaylist("a", "Ambient"),
            localPlaylist("b", "Focus"),
            localPlaylist("c", "Ambient 2"),
        )

        assertEquals(setOf("a", "b", "c"), selectAllFiltered(filter(source, "ambient"), setOf("b")))
    }

    @Test
    fun invertChangesOnlyFilteredIds() {
        val source = listOf(
            localPlaylist("a", "Ambient"),
            localPlaylist("b", "Focus"),
            localPlaylist("c", "Ambient 2"),
        )

        assertEquals(setOf("b", "c"), invertFiltered(filter(source, "ambient"), setOf("a", "b")))
    }

    private fun localPlaylist(id: String, name: String, intro: String = "") = CollectedPlaylist(
        type = CollectedPlaylistType.LOCAL,
        id = id,
        name = name,
        intro = intro,
    )
}
