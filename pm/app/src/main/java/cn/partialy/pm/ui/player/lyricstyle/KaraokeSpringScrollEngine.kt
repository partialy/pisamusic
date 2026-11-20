package cn.partialy.pm.ui.player.lyricstyle

import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * AMLyric 风格的逐行错峰阻尼弹簧滚动与焦点过渡引擎：
 * 1. 采用二阶欠阻尼谐振子解析解（任意帧率 Δt 数值精确、支持连续切行速度继承）；
 * 2. 切行时下方歌词行按行距错峰启动（24ms/行级联波浪跟随），消除整块硬平移感；
 * 3. 每行独立维护平滑焦点权重 focusWeight ∈ [0, 1]，使旧行缩回/变暗与新行放大/亮起连续过渡，消除第 0 帧字号与行高跳变。
 */
internal class KaraokeSpringScrollEngine {

    private var capacity = 0
    private var currentY = FloatArray(0)
    private var velocityY = FloatArray(0)
    private var targetY = FloatArray(0)
    private var staggerDelayMs = FloatArray(0)

    private var focusWeight = FloatArray(0)
    private var focusVelocity = FloatArray(0)
    private var targetFocus = FloatArray(0)

    private var initialized = false
    private var activeIndex = -1
    private var lastStepUptimeMs = 0L

    var isAnimating: Boolean = false
        private set

    fun reset() {
        initialized = false
        activeIndex = -1
        lastStepUptimeMs = 0L
        isAnimating = false
    }

    fun ensureCapacity(lineCount: Int) {
        if (lineCount <= 0) {
            reset()
            return
        }
        if (lineCount == capacity) return
        capacity = lineCount
        currentY = FloatArray(lineCount)
        velocityY = FloatArray(lineCount)
        targetY = FloatArray(lineCount)
        staggerDelayMs = FloatArray(lineCount)
        focusWeight = FloatArray(lineCount)
        focusVelocity = FloatArray(lineCount)
        targetFocus = FloatArray(lineCount)
        initialized = false
        activeIndex = -1
    }

    /**
     * 当目标激活行或布局尺寸变化时更新各行目标坐标。
     * @param computeTargetY 计算当 selectedIndex 完全激活稳定后第 i 行相对中心基线的目标 Y 偏移。
     */
    fun updateTargets(
        lineCount: Int,
        selectedIndex: Int,
        nowUptimeMs: Long,
        animate: Boolean,
        computeTargetY: (index: Int) -> Float,
    ) {
        ensureCapacity(lineCount)
        if (lineCount <= 0 || selectedIndex !in 0 until lineCount) return

        val prevIndex = activeIndex
        val delta = if (initialized && prevIndex >= 0) selectedIndex - prevIndex else 0
        val shouldSpring = animate && initialized && prevIndex >= 0 && abs(delta) in 1..4

        for (i in 0 until lineCount) {
            targetY[i] = computeTargetY(i)
            targetFocus[i] = if (i == selectedIndex) 1f else 0f
        }

        if (!shouldSpring) {
            for (i in 0 until lineCount) {
                currentY[i] = targetY[i]
                velocityY[i] = 0f
                staggerDelayMs[i] = 0f
                focusWeight[i] = targetFocus[i]
                focusVelocity[i] = 0f
            }
            activeIndex = selectedIndex
            initialized = true
            lastStepUptimeMs = nowUptimeMs
            isAnimating = false
            return
        }

        if (selectedIndex != prevIndex) {
            // 错峰级联延迟：向上滚（delta > 0）时，上方与当前行先行，下方候选行按距离依次滞后 24ms 跟进
            for (i in 0 until lineCount) {
                val relativeOrder = if (delta > 0) {
                    i - prevIndex
                } else {
                    prevIndex - i
                }
                val delay = when {
                    relativeOrder <= 0 -> 0f
                    relativeOrder == 1 -> 14f
                    else -> min(MAX_STAGGER_DELAY_MS, 14f + (relativeOrder - 1) * STAGGER_STEP_MS)
                }
                // 若该行已有较高运动速度（连续快速切行），减小错峰延迟以保持顺滑惯性
                staggerDelayMs[i] = if (abs(velocityY[i]) > 45f) delay * 0.35f else delay
            }
            activeIndex = selectedIndex
            lastStepUptimeMs = nowUptimeMs
            isAnimating = true
        } else {
            // 同行内布局重算（如宽度/字号变化）：平滑吸附到新目标
            for (i in 0 until lineCount) {
                if (!isAnimating) {
                    currentY[i] = targetY[i]
                }
            }
        }
    }

    /**
     * 在手动滑动浏览期间，直接把弹簧位置同步到手动浏览偏移，保证跟手无延迟且松手回弹起点准确。
     */
    fun syncToManualOffsets(
        lineCount: Int,
        selectedIndex: Int,
        nowUptimeMs: Long,
        computeManualY: (index: Int) -> Float,
    ) {
        ensureCapacity(lineCount)
        if (lineCount <= 0) return
        for (i in 0 until lineCount) {
            val y = computeManualY(i)
            currentY[i] = y
            targetY[i] = y
            velocityY[i] = 0f
            staggerDelayMs[i] = 0f
            val f = if (i == selectedIndex) 1f else 0f
            focusWeight[i] = f
            targetFocus[i] = f
            focusVelocity[i] = 0f
        }
        activeIndex = selectedIndex
        initialized = true
        lastStepUptimeMs = nowUptimeMs
        isAnimating = false
    }

    /**
     * 推进一帧二阶阻尼弹簧物理状态；返回 true 表示尚未完全静止，需继续请求下一帧。
     */
    fun step(nowUptimeMs: Long, firstVisible: Int = 0, lastVisible: Int = capacity - 1): Boolean {
        if (!initialized || capacity <= 0) {
            isAnimating = false
            return false
        }
        val rawDtMs = if (lastStepUptimeMs > 0L) (nowUptimeMs - lastStepUptimeMs).coerceIn(1L, 64L) else 16L
        lastStepUptimeMs = nowUptimeMs
        val dtMs = rawDtMs.toFloat()

        val simStart = (firstVisible - 4).coerceAtLeast(0)
        val simEnd = (lastVisible + 4).coerceAtMost(capacity - 1)
        var stillMoving = false

        for (i in 0 until capacity) {
            if (i < simStart || i > simEnd) {
                currentY[i] = targetY[i]
                velocityY[i] = 0f
                staggerDelayMs[i] = 0f
                focusWeight[i] = targetFocus[i]
                focusVelocity[i] = 0f
                continue
            }

            // 1) 垂直位置错峰二阶弹簧
            var effectiveDtSec = dtMs / 1000f
            val delay = staggerDelayMs[i]
            if (delay > 0f) {
                if (dtMs <= delay) {
                    staggerDelayMs[i] = delay - dtMs
                    // 错峰等待期内以极低刚度轻微预启动，避免静止到启动出现棱角
                    effectiveDtSec = (dtMs * 0.18f) / 1000f
                    stillMoving = true
                } else {
                    staggerDelayMs[i] = 0f
                    effectiveDtSec = (dtMs - delay * 0.82f) / 1000f
                }
            }

            // 距离中心越远的行阻尼略高、刚度微降，增强级联柔顺感
            val distFromActive = abs(i - activeIndex).coerceAtMost(6)
            val rowOmega = SCROLL_OMEGA / (1f + 0.035f * distFromActive)
            val yResult = stepAnalyticalSpring(
                current = currentY[i],
                velocity = velocityY[i],
                target = targetY[i],
                dtSec = effectiveDtSec,
                omega = rowOmega,
                zeta = SCROLL_ZETA,
                posThreshold = 0.25f,
                velThreshold = 2.0f,
            )
            currentY[i] = yResult.position
            velocityY[i] = yResult.velocity
            if (!yResult.settled) stillMoving = true

            // 2) 焦点权重（字号缩放 + 明暗过渡）二阶弹簧
            val fResult = stepAnalyticalSpring(
                current = focusWeight[i],
                velocity = focusVelocity[i],
                target = targetFocus[i],
                dtSec = dtMs / 1000f,
                omega = FOCUS_OMEGA,
                zeta = FOCUS_ZETA,
                posThreshold = 0.003f,
                velThreshold = 0.02f,
            )
            focusWeight[i] = fResult.position.coerceIn(0f, 1.04f)
            focusVelocity[i] = fResult.velocity
            if (!fResult.settled) stillMoving = true
        }

        isAnimating = stillMoving
        return stillMoving
    }

    fun getRowOffsetY(index: Int): Float =
        if (index in 0 until capacity) currentY[index] else 0f

    fun getRowFocusWeight(index: Int): Float =
        if (index in 0 until capacity) focusWeight[index].coerceIn(0f, 1f) else 0f

    internal data class SpringStepResult(
        val position: Float,
        val velocity: Float,
        val settled: Boolean,
    )

    internal companion object {
        // 滚动弹簧：ω_n = 12.6 rad/s, ζ = 0.84（轻度欠阻尼，丝滑加速与柔和落位缓冲）
        const val SCROLL_OMEGA = 12.6f
        const val SCROLL_ZETA = 0.84f

        // 焦点缩放/透明度弹簧：ω_n = 14.2 rad/s, ζ = 0.92（近临界阻尼，平滑无闪烁）
        const val FOCUS_OMEGA = 14.2f
        const val FOCUS_ZETA = 0.92f

        const val STAGGER_STEP_MS = 24f
        const val MAX_STAGGER_DELAY_MS = 125f

        /**
         * 二阶欠阻尼弹簧谐振子解析解：
         * x'' + 2 ζ ω_n x' + ω_n^2 (x - target) = 0
         */
        fun stepAnalyticalSpring(
            current: Float,
            velocity: Float,
            target: Float,
            dtSec: Float,
            omega: Float,
            zeta: Float,
            posThreshold: Float,
            velThreshold: Float,
        ): SpringStepResult {
            val x0 = current - target
            if (abs(x0) <= posThreshold && abs(velocity) <= velThreshold) {
                return SpringStepResult(target, 0f, settled = true)
            }
            if (dtSec <= 0f) {
                return SpringStepResult(current, velocity, settled = false)
            }

            val clampedZeta = zeta.coerceIn(0.1f, 0.999f)
            val omegaD = omega * sqrt(max(1e-4f, 1f - clampedZeta * clampedZeta))
            val decay = exp((-clampedZeta * omega * dtSec).toDouble()).toFloat()
            val angle = (omegaD * dtSec).toDouble()
            val cosA = cos(angle).toFloat()
            val sinA = sin(angle).toFloat()

            val nextOffset = decay * (x0 * cosA + ((velocity + clampedZeta * omega * x0) / omegaD) * sinA)
            val nextVel = decay * (
                velocity * cosA -
                    ((omega * omega * x0 + clampedZeta * omega * velocity) / omegaD) * sinA
                )
            val nextPos = target + nextOffset
            val settled = abs(nextOffset) <= posThreshold && abs(nextVel) <= velThreshold
            return if (settled) {
                SpringStepResult(target, 0f, settled = true)
            } else {
                SpringStepResult(nextPos, nextVel, settled = false)
            }
        }
    }
}
