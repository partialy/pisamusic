package cn.partialy.pm.ui.player.background

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FlowingCoverMotionRulesTest {
    @Test
    fun `same seed generates stable motion`() {
        assertEquals(FlowingCoverMotionRules.specs(42L), FlowingCoverMotionRules.specs(42L))
    }

    @Test
    fun `different seeds change at least one layer`() {
        assertNotEquals(FlowingCoverMotionRules.specs(42L), FlowingCoverMotionRules.specs(43L))
    }

    @Test
    fun `trajectory is continuous and visibly moving`() {
        FlowingCoverMotionRules.specs(42).forEachIndexed { index, spec ->
            assertTrue(spec.periodSeconds in 16.0..28.0)
            val start = FlowingCoverMotionRules.position(spec, index, 5.0, 1f)
            val nearby = FlowingCoverMotionRules.position(spec, index, 5.001, 1f)
            val later = FlowingCoverMotionRules.position(spec, index, 10.0, 1f)
            assertTrue(kotlin.math.abs(start.x - nearby.x) < 0.001)
            assertNotEquals(start, later)
            assertEquals(FlowingCoverMotionRules.position(spec, index, 0.0, 0f).x,
                FlowingCoverMotionRules.position(spec, index, 10.0, 0f).x)
        }
    }

    @Test
    fun `preview and power save have reduced frame budget`() {
        assertEquals(34L, FlowingCoverMotionRules.frameIntervalMs(false, false))
        assertEquals(67L, FlowingCoverMotionRules.frameIntervalMs(true, false))
        assertEquals(67L, FlowingCoverMotionRules.frameIntervalMs(false, true))
    }
}
