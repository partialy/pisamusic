package cn.partialy.pm.listen

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ListenTogetherSyncRulesTest {
    private val songA = ListenTogetherSong(id = "A", source = "kg")
    private val songB = ListenTogetherSong(id = "B", source = "kg")

    @Test
    fun queueItemIdSelectsTheCorrectDuplicateSong() {
        val queue = ListenTogetherQueueState(
            currentItemId = "A-1",
            items = listOf(
                ListenTogetherQueueItem(queueItemId = "A-1", song = songA),
                ListenTogetherQueueItem(queueItemId = "B", song = songB),
                ListenTogetherQueueItem(queueItemId = "A-2", song = songA),
            ),
        )

        val result = resolveQueuePointer(queue, songA, queueItemId = "A-2")

        assertEquals("A-2", result.queueItemId)
        assertFalse(result.requestSnapshot)
    }

    @Test
    fun legacyDuplicateSongDoesNotGuessTheFirstQueueItem() {
        val queue = ListenTogetherQueueState(
            items = listOf(
                ListenTogetherQueueItem(queueItemId = "A-1", song = songA),
                ListenTogetherQueueItem(queueItemId = "A-2", song = songA),
            ),
        )

        val result = resolveQueuePointer(queue, songA, queueItemId = null)

        assertNull(result.queueItemId)
        assertTrue(result.requestSnapshot)
    }

    @Test
    fun onlyMatchingChangeSongCompletesTransition() {
        assertFalse(shouldCompleteTransition("PLAY", "transition-C", "transition-C"))
        assertFalse(shouldCompleteTransition("CHANGE_SONG", "transition-C", "transition-B"))
        assertTrue(shouldCompleteTransition("CHANGE_SONG", "transition-C", "transition-C"))
    }
}
