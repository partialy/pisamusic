package cn.partialy.pm.listen

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ListenTogetherPlaylistReplacementTest {
    private val a = ListenTogetherSong(id = "A", source = "kg")
    private val b = ListenTogetherSong(id = "B", source = "wy")
    private val c = ListenTogetherSong(id = "C", source = "kg")

    @Test
    fun sameCurrentSongStillReplacesTheRestOfThePlaylist() {
        val previous = ListenTogetherQueueState(
            queueVersion = 7,
            currentItemId = "A-old",
            items = listOf(
                ListenTogetherQueueItem("A-old", a),
                ListenTogetherQueueItem("B-old", b),
            ),
        )
        val next = replaceHostPlaylistQueue(previous, listOf(a, c), a, "host", newItemId = { "C-new" })

        assertEquals(8L, next.queueVersion)
        assertEquals(listOf("A", "C"), next.items.map { it.song.id })
        assertEquals("A-old", next.currentItemId)
        assertEquals("C-new", next.items[next.currentIndex() + 1].queueItemId)
    }

    @Test
    fun matchingSongsKeepRicherProtocolMetadataAndAttribution() {
        val previousItem = ListenTogetherQueueItem(
            queueItemId = "A-old",
            song = a.copy(name = "原歌名", cover = "https://cover", duration = 9000, vip = true),
            addedByUserId = "member",
            addedAt = 123L,
        )
        val next = replaceHostPlaylistQueue(
            ListenTogetherQueueState(items = listOf(previousItem)),
            listOf(a.copy(name = "新歌名")), a, "host",
        )

        assertEquals("新歌名", next.items.single().song.name)
        assertEquals("https://cover", next.items.single().song.cover)
        assertEquals(9000L, next.items.single().song.duration)
        assertEquals(true, next.items.single().song.vip)
        assertEquals("member", next.items.single().addedByUserId)
        assertEquals(123L, next.items.single().addedAt)
    }

    @Test
    fun latestReplacementWinsEvenWhenTheSelectedSongIsUnchanged() {
        val first = replaceHostPlaylistQueue(ListenTogetherQueueState(), listOf(a, b), a, "host")
        val second = replaceHostPlaylistQueue(first, listOf(c, a), a, "host")

        assertEquals(2L, second.queueVersion)
        assertEquals(listOf("C", "A"), second.items.map { it.song.id })
        assertEquals(1, second.currentIndex())
    }

    @Test
    fun onlyMembersAcceptStructureFromTheCurrentHost() {
        assertTrue(shouldAcceptHostQueueStructure("member", "host", "host"))
        assertFalse(shouldAcceptHostQueueStructure("host", "host", "member"))
        assertFalse(shouldAcceptHostQueueStructure("member", "host", "other-member"))
        assertFalse(shouldAcceptHostQueueStructure("member", "new-host", "host"))
        assertFalse(shouldAcceptHostQueueStructure("member", "host", ""))
        assertFalse(shouldAcceptHostQueueStructure("member", null, "host"))
    }

    @Test
    fun reconnectUsesLatestPausedIntentWhileInitialRequestStartsPlayback() {
        assertTrue(playlistReplacementAutoPlay(initialRequest = true, playWhenReady = false))
        assertFalse(playlistReplacementAutoPlay(initialRequest = false, playWhenReady = false))
        assertTrue(playlistReplacementAutoPlay(initialRequest = false, playWhenReady = true))
    }

    @Test
    fun lateSnapshotCannotOverwriteANewerPlaylistDelta() {
        val snapshotVersion = 7L
        assertTrue(shouldAcceptQueueSnapshotVersion(snapshotVersion, currentVersion = 7L))
        val currentVersionAfterDelta = 8L
        assertFalse(shouldAcceptQueueSnapshotVersion(snapshotVersion, currentVersionAfterDelta))
        assertTrue(shouldAcceptQueueSnapshotVersion(9L, currentVersionAfterDelta))
    }
}
