package cn.partialy.pm.ui.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LyricPreviewSamplesTest {
    @Test
    fun eachWordCoversAContinuousPositiveIntervalWithinItsLine() {
        val lines = LyricPreviewSamples.lines
        assertEquals(3, lines.size)
        assertEquals(0L, lines.first().startTime)
        assertEquals(8_000L, lines.last().endTime)
        lines.zipWithNext().forEach { (left, right) -> assertEquals(left.endTime, right.startTime) }
        lines.forEach { line ->
            assertTrue(line.hasWordTiming)
            assertEquals(line.startTime, line.words.first().startTime)
            assertEquals(line.endTime, line.words.last().endTime)
            line.words.forEach { assertTrue(it.startTime < it.endTime) }
            line.words.zipWithNext().forEach { (left, right) -> assertEquals(left.endTime, right.startTime) }
        }
    }

    @Test
    fun exactLineBoundariesAndLoopWrapChooseTheExpectedLine() {
        listOf(0L to 0, 2_499L to 0, 2_500L to 1, 5_199L to 1, 5_200L to 2,
            7_999L to 2, 8_000L to 0, 10_500L to 1, 16_000L to 0).forEach { (time, index) ->
            assertEquals("time=$time", index, LyricPreviewSamples.indexAt(time))
        }
        assertEquals(0L, LyricPreviewSamples.positionAt(16_000L))
        assertEquals(7_999L, LyricPreviewSamples.positionAt(-1L))
    }
}
