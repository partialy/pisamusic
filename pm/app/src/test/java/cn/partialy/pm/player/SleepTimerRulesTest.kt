package cn.partialy.pm.player

import org.junit.Assert.assertEquals
import org.junit.Test

class SleepTimerRulesTest {
    @Test
    fun remainingSecondsRoundsUpPartialSecond() {
        assertEquals(2L, SleepTimerRules.remainingSeconds(2_001L, 1_000L))
        assertEquals(0L, SleepTimerRules.remainingSeconds(1_000L, 1_000L))
    }

    @Test
    fun customTimeStaysWithinSupportedRange() {
        assertEquals(1, SleepTimerRules.toMinutes(0, 0))
        assertEquals(1439, SleepTimerRules.toMinutes(23, 59))
        assertEquals(90, SleepTimerRules.toMinutes(1, 30))
    }

    @Test
    fun remainingTimeUsesCompactClockFormat() {
        assertEquals("09:05", SleepTimerRules.formatRemaining(545L))
        assertEquals("01:02:03", SleepTimerRules.formatRemaining(3_723L))
    }

    @Test
    fun presetSlotsUseFourDefaultsAndRepairInvalidValuesByPosition() {
        assertEquals(listOf(5, 15, 30, 60), SleepTimerRules.normalizePresets(emptyList()))
        assertEquals(
            listOf(90, 15, 1439, 60),
            SleepTimerRules.normalizePresets(listOf(90, 0, 1439, 1440)),
        )
    }
}
