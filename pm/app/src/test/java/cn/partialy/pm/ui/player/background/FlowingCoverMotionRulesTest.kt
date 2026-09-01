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
    fun `motion stays subtle and slow`() {
        FlowingCoverMotionRules.specs(42L).forEach { spec ->
            assertTrue(spec.durationMs in 29_000L..53_000L)
            assertTrue(spec.translationXFraction in -0.12f..0.12f)
            assertTrue(spec.translationYFraction in -0.12f..0.12f)
            assertTrue(spec.scale in 1.04f..1.18f)
            assertTrue(spec.rotationDegrees in -2.0f..2.0f)
        }
    }
}
