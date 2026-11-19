package cn.partialy.pm.ui.player.lyricstyle

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LyricSpringPhysicsTest {

    @Test
    fun springConvergesToTargetAndCarriesVelocityOnRetarget() {
        val spring = SpringState(initialValue = 0f, initialTarget = 1f)
        repeat(4) {
            assertTrue(spring.step(0.016f, omega = 13.5f, zeta = 0.86f))
        }
        val midValue = spring.value
        val midVelocity = spring.velocity
        assertTrue(midValue > 0f && midValue < 1f)
        assertTrue(midVelocity > 0f)

        // 中途连续切换目标到第 2 行：保留当前位置与正速度
        spring.target = 2f
        assertEquals(midValue, spring.value, 0.0001f)
        assertEquals(midVelocity, spring.velocity, 0.0001f)

        var steps = 0
        while (spring.step(0.016f, omega = 13.5f, zeta = 0.86f) && steps < 200) {
            steps++
        }
        assertTrue(spring.isSettled)
        assertEquals(2f, spring.value, 0.0001f)
        assertEquals(0f, spring.velocity, 0.0001f)
    }

    @Test
    fun cascadeDelaysLowerRowsWhenAdvancingForward() {
        val controller = LyricCascadeScrollController()
        controller.updateTarget(nextCurrentIndex = 0, animate = false)
        assertFalse(controller.hasActiveAnimation)

        controller.updateTarget(nextCurrentIndex = 1, animate = true, visibleStart = 0, visibleEnd = 5)
        assertTrue(controller.hasActiveAnimation)

        // 推进 2 帧（共 32ms）：上方旧行（0）和刚切入行（1）已起跳，下方第 3 行仍在级联延迟等待
        controller.step(16f)
        controller.step(16f)

        val posLine0 = controller.scrollPositionForLine(0, 1)
        val posLine1 = controller.scrollPositionForLine(1, 1)
        val posLine3 = controller.scrollPositionForLine(3, 1)

        assertTrue("Line 0 should start moving first", posLine0 > 0f)
        assertTrue("Line 1 should lead Line 3 during cascade", posLine1 > posLine3)
        assertEquals("Line 3 should still be waiting for cascade delay at 32ms", 0f, posLine3, 0.0001f)
    }

    @Test
    fun exitingLineSmoothlyDecaysEmphasisWhileEnteringLineRises() {
        val controller = LyricCascadeScrollController()
        controller.updateTarget(nextCurrentIndex = 2, animate = false)
        assertEquals(1f, controller.emphasisForLine(2, 2), 0.0001f)
        assertEquals(0f, controller.emphasisForLine(3, 2), 0.0001f)

        controller.updateTarget(nextCurrentIndex = 3, animate = true, visibleStart = 0, visibleEnd = 6)
        controller.step(16f)
        controller.step(16f)

        val oldLineEmphasis = controller.emphasisForLine(2, 3)
        val newLineEmphasis = controller.emphasisForLine(3, 3)
        assertTrue("Old line should decay gradually from 1.0", oldLineEmphasis in 0.2f..0.99f)
        assertTrue("New line should grow gradually from 0.0", newLineEmphasis in 0.01f..0.8f)
    }

    @Test
    fun largeJumpSkipsCascadeAndSnapToSettlesImmediately() {
        val controller = LyricCascadeScrollController()
        controller.updateTarget(nextCurrentIndex = 0, animate = false)
        controller.updateTarget(nextCurrentIndex = 20, animate = true, visibleStart = 15, visibleEnd = 25)
        controller.step(16f)
        assertTrue(controller.scrollPositionForLine(22, 20) > 0f)

        controller.snapTo(20)
        assertFalse(controller.hasActiveAnimation)
        assertEquals(20f, controller.scrollPositionForLine(22, 20), 0.0001f)
    }
}
