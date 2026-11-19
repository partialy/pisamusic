package cn.partialy.pm.ui.player.lyricstyle

import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Shader
import kotlin.math.max
import kotlin.math.min

/**
 * 流彩星尘霓虹渲染器：
 * 复用三段极光循环 LinearGradient + Matrix 流动平移，并在扫描前沿叠加纯白锐利高光锋。
 */
internal class NeonFlowLyricRenderer : LyricEffectRenderer {
    private val flowMatrix = Matrix()
    private val tipMatrix = Matrix()
    private var flowShader: LinearGradient? = null
    private var cachedC1 = 0
    private var cachedC2 = 0
    private var cachedC3 = 0

    private val tipShader: LinearGradient = LinearGradient(
        0f,
        0f,
        1f,
        0f,
        intArrayOf(0x00FFFFFF, 0xEBFFFFFF.toInt()),
        floatArrayOf(0f, 1f),
        Shader.TileMode.CLAMP,
    )

    override fun drawCurrentLine(canvas: Canvas, frame: LyricEffectRenderFrame) {
        val runs = frame.layout.runs
        if (runs.isEmpty()) return
        val style = frame.effectConfig.neon
        val paint = frame.paint

        // 1) 未唱底字
        paint.shader = null
        paint.clearShadowLayer()
        paint.color = style.unlitColorArgb
        for (run in runs) {
            canvas.drawText(run.text, run.x, run.baselineY, paint)
        }

        if (!frame.showProgress) return

        val totalW = frame.layout.totalLogicalWidth
        val revealMs = style.lineRevealDurationMs.coerceAtLeast(120).toFloat()
        val lineProgress = clampProgress(frame.elapsedMs / revealMs)
        val scanX = if (frame.wordMode) {
            computeWordScanX(runs, frame.positionMs, totalW)
        } else {
            totalW * lineProgress
        }
        if (scanX <= 0.5f) return

        val flowShift = if (frame.wordMode) {
            frame.elapsedMs * 0.06f * style.flowSpeed * frame.density
        } else if (lineProgress >= 1f) {
            (frame.elapsedMs - revealMs) * 0.12f * style.flowSpeed * frame.density
        } else {
            0f
        }

        val shader = ensureFlowShader(style.colorStartArgb, style.colorMidArgb, style.colorEndArgb)
        val cycleW = max(160f * frame.density, totalW)
        val tipSpanPx = 18f * frame.density
        val glowRadius = 9f * frame.density

        for (run in runs) {
            val sungWidth = min(run.width, scanX - run.logicalX)
            if (sungWidth <= 0.5f) continue

            val originX = run.x - run.logicalX
            val modShift = ((flowShift % cycleW) + cycleW) % cycleW
            val gradStart = originX - modShift

            flowMatrix.reset()
            flowMatrix.setScale(cycleW * 2f, 1f)
            flowMatrix.postTranslate(gradStart, 0f)
            shader.setLocalMatrix(flowMatrix)

            canvas.save()
            canvas.clipRect(
                run.x - 10f * frame.density,
                run.baselineY - paint.textSize * 1.6f,
                run.x + sungWidth,
                run.baselineY + paint.textSize * 0.8f,
            )
            paint.shader = shader
            paint.setShadowLayer(glowRadius, 0f, 0f, colorWithAlpha(style.colorMidArgb, 0.58f))
            canvas.drawText(run.text, run.x, run.baselineY, paint)
            paint.clearShadowLayer()

            // 扫描前沿锐利白光锋
            if (scanX < totalW - 2f && scanX >= run.logicalX && scanX <= run.logicalX + run.width) {
                val tipX = originX + scanX
                tipMatrix.reset()
                tipMatrix.setScale(tipSpanPx, 1f)
                tipMatrix.postTranslate(tipX - tipSpanPx + 2f * frame.density, 0f)
                tipShader.setLocalMatrix(tipMatrix)
                paint.shader = tipShader
                canvas.drawText(run.text, run.x, run.baselineY, paint)
            }
            paint.shader = null
            canvas.restore()
        }
    }

    private fun computeWordScanX(runs: List<EffectRun>, positionMs: Long, totalW: Float): Float {
        var x = 0f
        var started = false
        for (run in runs) {
            val p = runProgress(run, positionMs)
            if (p <= 0f) return x
            started = true
            x = run.logicalX + run.width * p
            if (p < 1f) return x
        }
        return if (started) totalW else 0f
    }

    private fun ensureFlowShader(c1: Int, c2: Int, c3: Int): LinearGradient {
        val current = flowShader
        if (current != null && cachedC1 == c1 && cachedC2 == c2 && cachedC3 == c3) {
            return current
        }
        cachedC1 = c1
        cachedC2 = c2
        cachedC3 = c3
        return LinearGradient(
            0f,
            0f,
            1f,
            0f,
            intArrayOf(c1, c2, c3, c1, c2, c3, c1),
            floatArrayOf(0f, 0.166f, 0.333f, 0.5f, 0.666f, 0.833f, 1f),
            Shader.TileMode.CLAMP,
        ).also { flowShader = it }
    }
}
