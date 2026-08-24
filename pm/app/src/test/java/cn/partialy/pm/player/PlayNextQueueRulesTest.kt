package cn.partialy.pm.player

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PlayNextQueueRulesTest {

    @Test
    fun repeatedSongIsOnlyQueuedOnce() {
        val song = song("same", SongType.KG)

        val result = enqueueUniqueBy(listOf(song), song, ::songIdentityKey)

        assertEquals(listOf(song), result)
    }

    @Test
    fun sameIdFromDifferentSourcesCanBothBeQueued() {
        val kgSong = song("same", SongType.KG)
        val wySong = song("same", SongType.WY)

        val result = enqueueUniqueBy(listOf(kgSong), wySong, ::songIdentityKey)

        assertEquals(listOf(kgSong, wySong), result)
        assertNotEquals(songIdentityKey(kgSong), songIdentityKey(wySong))
    }

    @Test
    fun existingTailPlaceholderMovesNextWithoutDuplication() {
        val current = song("current")
        val normalNext = song("normal")
        val queued = song("queued")

        val result = planPlayNextPlacement(
            songs = listOf(current, normalNext, queued),
            requestedIndex = 1,
            song = queued,
            keyOf = ::songIdentityKey,
        )

        assertEquals(listOf(current, queued, normalNext), result.songs)
        assertEquals(2, result.previousIndex)
        assertEquals(1, result.targetIndex)
    }

    @Test
    fun movingAnEarlierItemCorrectsTheFinalTargetIndex() {
        val queued = song("queued")
        val previous = song("previous")
        val current = song("current")
        val normalNext = song("normal")

        val result = planPlayNextPlacement(
            songs = listOf(queued, previous, current, normalNext),
            requestedIndex = 3,
            song = queued,
            keyOf = ::songIdentityKey,
        )

        assertEquals(listOf(previous, current, queued, normalNext), result.songs)
        assertEquals(0, result.previousIndex)
        assertEquals(2, result.targetIndex)
    }

    @Test
    fun missingItemIsInsertedOnceAtRequestedPosition() {
        val current = song("current")
        val normalNext = song("normal")
        val queued = song("queued")

        val result = planPlayNextPlacement(
            songs = listOf(current, normalNext),
            requestedIndex = 1,
            song = queued,
            keyOf = ::songIdentityKey,
        )

        assertEquals(listOf(current, queued, normalNext), result.songs)
        assertEquals(null, result.previousIndex)
        assertEquals(1, result.targetIndex)
    }

    @Test
    fun persistedDuplicatesAreRemovedAndCurrentSongIsPreserved() {
        val first = song("first")
        val duplicatedCurrent = song("current")
        val otherSourceWithSameId = song("current", SongType.WY)

        val result = normalizePlaylist(
            songs = listOf(first, duplicatedCurrent, otherSourceWithSameId, duplicatedCurrent.copy(name = "new")),
            currentIndex = 3,
            keyOf = ::songIdentityKey,
        )

        assertEquals(listOf(first, duplicatedCurrent, otherSourceWithSameId), result.songs)
        assertEquals(1, result.currentIndex)
    }

    private fun song(id: String, type: SongType = SongType.KG) = SongInfo(
        id = id,
        type = type,
        name = id,
        artist = "artist",
        coverUrl = "",
    )
}
