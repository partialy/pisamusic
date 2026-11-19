package cn.partialy.pm.ui.player.lyricstyle

import kotlin.math.abs

/**
 * 二阶阻尼弹簧物理状态：采用半隐式欧拉子步积分，支持运动途中无跳变更新目标值。
 */
internal class SpringState(
    initialValue: Float = 0f,
    initialVelocity: Float = 0f,
    initialTarget: Float = initialValue,
) {
    var value: Float = initialValue
    var velocity: Float = initialVelocity
    var target: Float = initialTarget

    val isSettled: Boolean
        get() = value == target && velocity == 0f

    fun snapTo(newValue: Float) {
        value = newValue
        target = newValue
        velocity = 0f
    }

    /**
     * 推进一个时间步长；返回 true 表示仍在运动需要下一帧。
     */
    fun step(
        dtSec: Float,
        omega: Float,
        zeta: Float,
        posEpsilon: Float = DEFAULT_POS_EPSILON,
        velEpsilon: Float = DEFAULT_VEL_EPSILON,
    ): Boolean {
        if (isSettled) return false
        val clampedDt = dtSec.coerceIn(0f, MAX_FRAME_DT_SEC)
        if (clampedDt <= 0f) return true

        val steps = if (clampedDt > SUBSTEP_THRESHOLD_SEC) 2 else 1
        val subDt = clampedDt / steps
        val k = omega * omega
        val c = 2f * zeta * omega

        repeat(steps) {
            val displacement = value - target
            val accel = -k * displacement - c * velocity
            velocity += accel * subDt
            value += velocity * subDt
        }

        if (abs(target - value) <= posEpsilon && abs(velocity) <= velEpsilon) {
            value = target
            velocity = 0f
            return false
        }
        return true
    }

    private companion object {
        const val MAX_FRAME_DT_SEC = 0.032f
        const val SUBSTEP_THRESHOLD_SEC = 0.016f
        const val DEFAULT_POS_EPSILON = 0.0008f
        const val DEFAULT_VEL_EPSILON = 0.003f
    }
}

/**
 * AMLyric 风格逐行级联弹簧控制器：
 * - 为可见行维护独立的逻辑中心位置弹簧（带行间错峰级联延迟）与强调度弹簧（0..1）；
 * - 连续切行保留速度与位置，不重置；
 * - 大跨度 Seek（|delta| > 8）直接跳过级联延迟快速收敛。
 */
internal class LyricCascadeScrollController {

    private class RowState(
        scrollPos: Float,
        emphasis: Float,
    ) {
        val scroll = SpringState(initialValue = scrollPos, initialTarget = scrollPos)
        val emphasis = SpringState(initialValue = emphasis, initialTarget = emphasis)
        var delayRemainingMs: Float = 0f
    }

    private val rowStates = HashMap<Int, RowState>(32)
    private var anchorIndex: Int = -1
    private var selectedLineIndex: Int = -1

    val hasActiveAnimation: Boolean
        get() {
            for (state in rowStates.values) {
                if (state.delayRemainingMs > 0f || !state.scroll.isSettled || !state.emphasis.isSettled) {
                    return true
                }
            }
            return false
        }

    fun reset(currentIndex: Int) {
        rowStates.clear()
        anchorIndex = currentIndex
        selectedLineIndex = currentIndex
    }

    fun snapTo(currentIndex: Int, selectedIndex: Int = currentIndex) {
        anchorIndex = currentIndex
        selectedLineIndex = selectedIndex
        for ((lineIdx, state) in rowStates) {
            state.delayRemainingMs = 0f
            state.scroll.snapTo(currentIndex.toFloat())
            state.emphasis.snapTo(if (lineIdx == selectedIndex) 1f else 0f)
        }
    }

    /**
     * 更新目标当前行与强调行。
     * @param animate 是否启用级联弹簧过渡；false 时立即收敛到目标态。
     */
    fun updateTarget(
        nextCurrentIndex: Int,
        nextSelectedIndex: Int = nextCurrentIndex,
        animate: Boolean = true,
        visibleStart: Int = (nextCurrentIndex - WINDOW_RADIUS).coerceAtLeast(0),
        visibleEnd: Int = nextCurrentIndex + WINDOW_RADIUS,
    ) {
        if (nextCurrentIndex < 0) {
            reset(-1)
            return
        }
        if (!animate || anchorIndex < 0) {
            snapTo(nextCurrentIndex, nextSelectedIndex)
            return
        }

        val prevAnchor = anchorIndex
        val prevSelected = selectedLineIndex
        val delta = nextCurrentIndex - prevAnchor
        val indexChanged = delta != 0
        val selectedChanged = nextSelectedIndex != selectedLineIndex
        anchorIndex = nextCurrentIndex
        selectedLineIndex = nextSelectedIndex

        if (indexChanged) {
            pruneOutsideWindow(nextCurrentIndex)
            val useCascade = abs(delta) in 1..MAX_CASCADE_DELTA
            val movingForward = delta > 0
            val rangeStart = minOf(prevAnchor, nextCurrentIndex, visibleStart) - WINDOW_RADIUS
            val rangeEnd = maxOf(prevAnchor, nextCurrentIndex, visibleEnd) + WINDOW_RADIUS
            for (lineIdx in rangeStart.coerceAtLeast(0)..rangeEnd) {
                val state = rowStates[lineIdx] ?: RowState(
                    scrollPos = prevAnchor.toFloat(),
                    emphasis = if (lineIdx == prevSelected) 1f else 0f,
                ).also { rowStates[lineIdx] = it }

                val alreadyMoving = !state.scroll.isSettled && abs(state.scroll.velocity) > ACTIVE_VELOCITY_THRESHOLD
                state.scroll.target = nextCurrentIndex.toFloat()
                state.emphasis.target = if (lineIdx == nextSelectedIndex) 1f else 0f

                if (!useCascade || alreadyMoving) {
                    state.delayRemainingMs = 0f
                } else {
                    val distance = if (movingForward) {
                        (lineIdx - (nextCurrentIndex - 1)).coerceAtLeast(0)
                    } else {
                        ((nextCurrentIndex + 1) - lineIdx).coerceAtLeast(0)
                    }
                    state.delayRemainingMs = (distance * CASCADE_STEP_MS).coerceAtMost(MAX_CASCADE_DELAY_MS)
                }
            }
        } else if (selectedChanged) {
            for ((lineIdx, state) in rowStates) {
                state.emphasis.target = if (lineIdx == nextSelectedIndex) 1f else 0f
            }
            if (nextSelectedIndex >= 0 && rowStates[nextSelectedIndex] == null) {
                rowStates[nextSelectedIndex] = RowState(
                    scrollPos = nextCurrentIndex.toFloat(),
                    emphasis = 0f,
                ).apply {
                    emphasis.target = 1f
                }
            }
        }
    }

    /**
     * 推进所有已登记行状态的弹簧物理步进。
     */
    fun step(dtMs: Float): Boolean {
        if (dtMs <= 0f || rowStates.isEmpty()) return false
        val clampedDtMs = dtMs.coerceIn(0f, MAX_FRAME_DT_MS)
        var active = false

        for (state in rowStates.values) {
            var scrollDtSec = clampedDtMs / 1000f
            if (state.delayRemainingMs > 0f) {
                if (clampedDtMs < state.delayRemainingMs) {
                    state.delayRemainingMs -= clampedDtMs
                    scrollDtSec = 0f
                    active = true
                } else {
                    scrollDtSec = (clampedDtMs - state.delayRemainingMs) / 1000f
                    state.delayRemainingMs = 0f
                }
            }

            if (scrollDtSec > 0f) {
                if (state.scroll.step(scrollDtSec, SCROLL_OMEGA, SCROLL_ZETA)) {
                    active = true
                }
            } else if (!state.scroll.isSettled) {
                active = true
            }

            if (state.emphasis.step(clampedDtMs / 1000f, EMPHASIS_OMEGA, EMPHASIS_ZETA)) {
                active = true
            }
        }
        return active
    }

    fun scrollPositionForLine(lineIndex: Int, fallbackIndex: Int): Float {
        val state = rowStates[lineIndex] ?: return fallbackIndex.toFloat()
        return state.scroll.value
    }

    fun emphasisForLine(lineIndex: Int, selectedIndex: Int): Float {
        val state = rowStates[lineIndex]
        if (state != null) return state.emphasis.value.coerceIn(0f, 1.15f)
        return if (lineIndex == selectedIndex) 1f else 0f
    }

    private fun pruneOutsideWindow(center: Int) {
        val minKeep = center - PRUNE_RADIUS
        val maxKeep = center + PRUNE_RADIUS
        val iterator = rowStates.entries.iterator()
        while (iterator.hasNext()) {
            val key = iterator.next().key
            if (key < minKeep || key > maxKeep) {
                iterator.remove()
            }
        }
    }

    private companion object {
        const val WINDOW_RADIUS = 10
        const val PRUNE_RADIUS = 24
        const val MAX_CASCADE_DELTA = 8
        const val CASCADE_STEP_MS = 28f
        const val MAX_CASCADE_DELAY_MS = 180f
        const val ACTIVE_VELOCITY_THRESHOLD = 0.08f
        const val MAX_FRAME_DT_MS = 32f

        const val SCROLL_OMEGA = 13.5f
        const val SCROLL_ZETA = 0.86f
        const val EMPHASIS_OMEGA = 15.5f
        const val EMPHASIS_ZETA = 0.90f
    }
}
