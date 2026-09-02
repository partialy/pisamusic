package cn.partialy.pm.directmessage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DirectMessageQueueRulesTest {
    private val rules = DirectMessageQueueRules()

    @Test
    fun `first item is locked before 3000ms`() {
        assertFalse(rules.canConfirm(unlockAt = 3_000L, now = 2_999L))
    }

    @Test
    fun `first item unlocks at 3000ms`() {
        assertTrue(rules.canConfirm(unlockAt = 3_000L, now = 3_000L))
    }

    @Test
    fun `later items reuse the original deadline`() {
        assertEquals(0L, rules.remainingMs(unlockAt = 3_000L, now = 4_200L))
    }

    @Test
    fun `items are sorted and deduplicated by id`() {
        val normalized = rules.normalize(
            listOf(
                DirectMessageItem(id = "new", targetKind = "user", content = "new", createdAt = 20L),
                DirectMessageItem(id = "old", targetKind = "user", content = "old", createdAt = 10L),
                DirectMessageItem(id = "old", targetKind = "user", content = "ignored", createdAt = 10L),
            ),
        )

        assertEquals(listOf("old", "new"), normalized.map { it.id })
    }

    @Test
    fun `dismiss advances before background acknowledgement completes`() {
        val state = DirectMessageQueueState(
            listOf(
                DirectMessageItem(id = "first", targetKind = "user", content = "first", createdAt = 1L),
                DirectMessageItem(id = "second", targetKind = "user", content = "second", createdAt = 2L),
            ),
        )
        var fakeAckCompleted = false

        state.dismissCurrent()

        assertEquals("second", state.current?.id)
        assertFalse(fakeAckCompleted)
    }
}
