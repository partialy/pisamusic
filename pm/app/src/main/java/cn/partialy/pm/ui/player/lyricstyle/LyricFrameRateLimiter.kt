package cn.partialy.pm.ui.player.lyricstyle

/**
 * 歌词渲染限帧器：支持 30 / 60 / 90 / 120 / 0（无限制，跑满显示器刷新率）。
 * 允许 1.2ms 帧到达抖动容差，避免 60Hz 屏幕偶发掉到 30FPS。
 */
class LyricFrameRateLimiter(targetFps: Int = LyricRenderFps.DEFAULT) {
    private var minIntervalMs: Double = 1000.0 / LyricRenderFps.DEFAULT
    private var lastDrawAtMs: Double? = null

    init {
        setTargetFps(targetFps)
    }

    fun setTargetFps(targetFps: Int) {
        val normalized = LyricRenderFps.normalize(targetFps)
        val nextInterval = if (normalized == LyricRenderFps.UNLIMITED) 0.0 else 1000.0 / normalized
        if (nextInterval != minIntervalMs) {
            minIntervalMs = nextInterval
            lastDrawAtMs = null
        }
    }

    fun shouldDraw(nowMs: Double): Boolean {
        if (minIntervalMs <= 0.0) {
            lastDrawAtMs = nowMs
            return true
        }
        val previous = lastDrawAtMs
        if (previous == null) {
            lastDrawAtMs = nowMs
            return true
        }
        val elapsed = nowMs - previous
        if (elapsed < 0.0) {
            lastDrawAtMs = nowMs
            return true
        }
        if (elapsed + JITTER_TOLERANCE_MS < minIntervalMs) {
            return false
        }
        val remainder = if (elapsed >= minIntervalMs * 2.0) 0.0 else (elapsed - minIntervalMs).coerceAtLeast(0.0)
        lastDrawAtMs = nowMs - remainder.coerceAtMost(minIntervalMs * 0.5)
        return true
    }

    fun shouldDrawNanos(frameTimeNanos: Long): Boolean =
        shouldDraw(frameTimeNanos / 1_000_000.0)

    fun reset() {
        lastDrawAtMs = null
    }

    private companion object {
        const val JITTER_TOLERANCE_MS = 1.2
    }
}
