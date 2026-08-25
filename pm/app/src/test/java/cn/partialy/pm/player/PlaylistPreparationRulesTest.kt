package cn.partialy.pm.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistPreparationRulesTest {

    @Test
    fun `batch is delivered only after every item is constructed`() {
        val events = mutableListOf<String>()

        val prepared = prepareAllOrNull(listOf("one", "two")) { value ->
            events += "build:$value"
            "item:$value"
        }
        if (prepared != null) events += "commit:${prepared.size}"

        assertEquals(listOf("build:one", "build:two", "commit:2"), events)
    }

    @Test
    fun `batch construction failure returns nothing to commit`() {
        val prepared = prepareAllOrNull(listOf("valid", "broken")) { value ->
            if (value == "broken") error("cannot register")
            "item:$value"
        }

        assertNull(prepared)
    }

    @Test
    fun `restore drops failed items and never fabricates a placeholder`() {
        val restored = prepareRestoredQueue(
            values = listOf("broken", "current", "next"),
            requestedIndex = 0,
        ) { value ->
            if (value == "broken") error("cannot register")
            "logical:$value"
        }

        requireNotNull(restored)
        assertEquals(listOf("current", "next"), restored.values)
        assertEquals(listOf("logical:current", "logical:next"), restored.items)
        assertEquals(0, restored.currentIndex)
    }

    @Test
    fun `restore abandons all failed queue instead of returning placeholder`() {
        val restored = prepareRestoredQueue(
            values = listOf("broken-1", "broken-2"),
            requestedIndex = 1,
        ) { error("cannot register") }

        assertNull(restored)
    }

    @Test
    fun `older prepared request cannot overwrite newer request`() {
        val gate = PlaylistPreparationGate()
        val older = gate.nextReplacement()
        val newer = gate.nextReplacement()

        assertFalse(gate.isCurrent(older))
        assertTrue(gate.isCurrent(newer))
    }
}
