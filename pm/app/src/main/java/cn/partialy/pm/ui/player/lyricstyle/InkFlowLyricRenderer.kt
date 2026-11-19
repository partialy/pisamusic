package cn.partialy.pm.ui.player.lyricstyle

import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Shader
import kotlin.math.PI
import kotlin.math.sin

/**
 * 水墨流光渲染器：
 * 复用单位宽 LinearGradient + LocalMatrix 平移实现水平羽化扫光，当前唱到的字轻微上浮。
 */
internal class InkFlowLyricRenderer : LyricEffectRenderer {
    private val shaderMatrix = Matrix()
    private var cachedShader: LinearGradient? = null
    private var cachedStartColor = 0
    private var cachedTipColor = 0
    private var cachedUnlitColor = 0

    override fun extraVerticalPaddingPx(
        config: LyricEffectConfig,
        textSizePx: Float,
        density: Float,
    ): Float = (config.ink.liftOffsetDp * density * 2f)

    override fun drawCurrentLine(canvas: Canvas, frame: LyricEffectRenderFrame) {
        val runs = frame.layout.runs
        if (runs.isEmpty()) return
        val style = frame.effectConfig.ink
        val paint = frame.paint

        if (!frame.showProgress) {
            paint.shader = null
            paint.clearShadowLayer()
            paint.color = style.unlitColorArgb
            for (run in runs) {
                canvas.drawText(run.text, run.x, run.baselineY, paint)
            }
            return
        }

        val featherPx = (style.featherWidthDp * frame.density).coerceAtLeast(4f)
        val liftPx = style.liftOffsetDp * frame.density
        val totalW = frame.layout.totalLogicalWidth

        var scanX = -featherPx
        var activeRun: EffectRun? = null
        var activeProgress = 0f

        if (frame.wordMode) {
            var started = false
            var foundActive = false
            for (run in runs) {
                val p = runProgress(run, frame.positionMs)
                if (p <= 0f) {
                    foundActive = true
                    break
                }
                started = true
                scanX = run.logicalX + run.width * p
                if (p < 1f) {
                    activeRun = run
                    activeProgress = p
                    foundActive = true
                    break
                }
            }
            if (!started) {
                scanX = -featherPx
            } else if (!foundActive) {
                scanX = totalW + featherPx
            }
        } else {
            val sweep = clampProgress(frame.elapsedMs / style.lineSweepDurationMs.coerceAtLeast(150).toFloat())
            scanX = -featherPx + (totalW + featherPx * 2f) * sweep
        }

        val shader = ensureShader(
            style.highlightStartColorArgb,
            style.highlightTipColorArgb,
            style.unlitColorArgb,
        )
        val gradientSpan = (featherPx * 2f).coerceAtLeast(1f)

        paint.clearShadowLayer()
        paint.shader = shader
        for (run in runs) {
            val localScanX = run.x + (scanX - run.logicalX)
            val gradStart = localScanX - featherPx
            shaderMatrix.reset()
            shaderMatrix.setScale(gradientSpan, 1f)
            shaderMatrix.postTranslate(gradStart, 0f)
            shader.setLocalMatrix(shaderMatrix)

            val offsetY = if (run === activeRun && liftPx > 0f) {
                -liftPx * sin(PI * activeProgress).toFloat()
            } else {
                0f
            }
            canvas.drawText(run.text, run.x, run.baselineY + offsetY, paint)
        }
        paint.shader = null
    }

    private fun ensureShader(startColor: Int, tipColor: Int, unlitColor: Int): LinearGradient {
        val current = cachedShader
        if (current != null &&
            cachedStartColor == startColor &&
            cachedTipColor == tipColor &&
            cachedUnlitColor == unlitColor
        ) {
            return current
        }
        cachedStartColor = startColor
        cachedTipColor = tipColor
        cachedUnlitColor = unlitColor
        return LinearGradient(
            0f,
            0f,
            1f,
            0f,
            intArrayOf(startColor, tipColor, unlitColor),
            floatArrayOf(0f, 0.52f, 1f),
            Shader.TileMode.CLAMP,
        ).also { cachedShader = it }
    }
}
