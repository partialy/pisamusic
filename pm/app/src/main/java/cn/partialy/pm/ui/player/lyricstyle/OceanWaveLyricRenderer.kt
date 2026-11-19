package cn.partialy.pm.ui.player.lyricstyle

import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * 海浪翻滚渲染器：
 * - 半径为 2 的余弦波核：当前波峰字 100% 跃起，左右紧邻各 1 字精确 50% 半高；
 * - swayEnabled 控制翻滚微倾摇晃与水平推涌（关闭后仅垂直上下跃起）；
 * - showWaveLine 控制每视觉行底部的海浪波纹线条与浪尖微粒。
 */
internal class OceanWaveLyricRenderer : LyricEffectRenderer {
    private val ribbonPath = Path()
    private val ribbonPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    private val foamPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    override fun extraVerticalPaddingPx(
        config: LyricEffectConfig,
        textSizePx: Float,
        density: Float,
    ): Float {
        val jumpPx = config.ocean.jumpHeightDp * density
        val waveExtra = if (config.ocean.showWaveLine) max(10f * density, textSizePx * 0.28f) else 0f
        return jumpPx * 1.4f + textSizePx * 0.12f + waveExtra
    }

    override fun drawCurrentLine(canvas: Canvas, frame: LyricEffectRenderFrame) {
        val glyphs = frame.layout.glyphs
        if (glyphs.isEmpty()) return
        val style = frame.effectConfig.ocean
        val paint = frame.paint

        if (!frame.showProgress) {
            paint.clearShadowLayer()
            paint.color = style.unlitColorArgb
            for (run in frame.layout.runs) {
                canvas.drawText(run.text, run.x, run.baselineY, paint)
            }
            return
        }

        val waveState = computeWaveState(
            glyphs = glyphs,
            positionMs = frame.positionMs,
            elapsedMs = frame.elapsedMs,
            wordMode = frame.wordMode,
        )
        val waveIndex = waveState.waveIndex
        val lineModeLitLimit = waveState.lineModeLitLimit

        if (style.showWaveLine) {
            for (row in frame.layout.rows) {
                drawRowWaveRibbon(canvas, frame, style, row, waveIndex)
            }
        }

        val jumpPx = style.jumpHeightDp * frame.density
        val midHeight = paint.textSize * 0.35f
        val surgeScalePx = 1.5f * frame.density

        glyphs.forEachIndexed { index, glyph ->
            val d = index - waveIndex
            val h = waveHeight(d)
            val offsetY = -jumpPx * h
            val scale = 1f + 0.11f * h
            val inWave = abs(d) < 2f
            val tiltDeg = if (style.swayEnabled && inWave) {
                sin(PI * d / 2.0).toFloat() * MAX_TILT_DEG
            } else {
                0f
            }
            val surgeX = if (style.swayEnabled && inWave) {
                sin(PI * d / 2.0).toFloat() * surgeScalePx
            } else {
                0f
            }
            val sungBlend = if (frame.wordMode) {
                min(1f, glyphProgress(glyph, frame.positionMs) * 1.35f)
            } else {
                clampProgress(lineModeLitLimit - index + 0.65f)
            }
            val activeWeight = h * 0.85f
            val glowRadius = (6f + 9f * h) * frame.density

            canvas.save()
            canvas.translate(glyph.x + glyph.width / 2f + surgeX, glyph.baselineY - midHeight + offsetY)
            if (tiltDeg != 0f) canvas.rotate(tiltDeg)
            if (scale != 1f) canvas.scale(scale, scale)

            drawHighlightLayers(
                canvas = canvas,
                paint = paint,
                text = glyph.text,
                x = -glyph.width / 2f,
                baselineY = midHeight,
                baseColor = style.unlitColorArgb,
                sungColor = style.sungColorArgb,
                activeColor = style.crestColorArgb,
                sung = sungBlend,
                active = activeWeight,
                glowColor = style.glowColorArgb,
                glowRadiusPx = glowRadius,
            )
            canvas.restore()
        }
    }

    private fun drawRowWaveRibbon(
        canvas: Canvas,
        frame: LyricEffectRenderFrame,
        style: OceanEffectConfig,
        row: EffectVisualRow,
        waveIndex: Float,
    ) {
        val rowCount = row.glyphs.size
        if (rowCount == 0) return
        val localWaveIndex = waveIndex - row.rowOffset
        val rowWaveActive = localWaveIndex > -2f && localWaveIndex < rowCount + 1.5f
        val crestX = rowCrestX(row.glyphs, localWaveIndex, frame.density)
        val avgCharW = max(14f * frame.density, (row.right - row.left) / rowCount)
        val overhang = 10f * frame.density
        val ribbonLeft = max(frame.paddingLeft.toFloat(), row.left - overhang)
        val ribbonRight = min((frame.viewWidth - frame.paddingRight).toFloat(), row.right + overhang)
        if (ribbonRight <= ribbonLeft + 2f) return

        val ribbonBaseY = row.baselineY + max(7f * frame.density, frame.paint.textSize * 0.24f)
        val ribbonLift = min(8f * frame.density, style.jumpHeightDp * frame.density * 0.58f)

        val colors: IntArray
        val stops: FloatArray
        if (rowWaveActive) {
            val ratio = ((crestX - ribbonLeft) / max(1f, ribbonRight - ribbonLeft)).coerceIn(0.08f, 0.92f)
            colors = intArrayOf(
                colorWithAlpha(style.glowColorArgb, 0f),
                colorWithAlpha(style.glowColorArgb, 0.28f),
                colorWithAlpha(style.crestColorArgb, 0.92f),
                colorWithAlpha(style.glowColorArgb, 0.28f),
                colorWithAlpha(style.glowColorArgb, 0f),
            )
            stops = floatArrayOf(
                0f,
                max(0f, ratio - 0.22f),
                ratio,
                min(1f, ratio + 0.22f),
                1f,
            )
        } else {
            colors = intArrayOf(
                colorWithAlpha(style.glowColorArgb, 0f),
                colorWithAlpha(style.glowColorArgb, 0.24f),
                colorWithAlpha(style.glowColorArgb, 0f),
            )
            stops = floatArrayOf(0f, 0.5f, 1f)
        }

        ribbonPath.reset()
        val stepPx = max(3f, 3.5f * frame.density)
        var x = ribbonLeft
        var first = true
        while (x <= ribbonRight) {
            val d = (x - crestX) / avgCharW
            val h = waveHeight(d)
            val ripple = sin(x / frame.density * 0.055 - frame.elapsedMs * 0.005).toFloat() * 1.0f * frame.density
            val y = ribbonBaseY - h * ribbonLift + ripple
            if (first) {
                ribbonPath.moveTo(x, y)
                first = false
            } else {
                ribbonPath.lineTo(x, y)
            }
            if (x == ribbonRight) break
            x = min(ribbonRight, x + stepPx)
        }

        ribbonPaint.strokeWidth = (frame.paint.textSize * 0.055f).coerceIn(1.5f * frame.density, 2.6f * frame.density)
        ribbonPaint.shader = LinearGradient(ribbonLeft, 0f, ribbonRight, 0f, colors, stops, Shader.TileMode.CLAMP)
        if (rowWaveActive) {
            ribbonPaint.setShadowLayer(7f * frame.density, 0f, 0f, colorWithAlpha(style.glowColorArgb, 0.8f))
        } else {
            ribbonPaint.clearShadowLayer()
        }
        canvas.drawPath(ribbonPath, ribbonPaint)
        ribbonPaint.shader = null
        ribbonPaint.clearShadowLayer()

        // 浪尖微粒
        if (rowWaveActive) {
            val midHeight = frame.paint.textSize * 0.35f
            val jumpPx = style.jumpHeightDp * frame.density
            for (s in 0 until 5) {
                val life = ((frame.elapsedMs * 0.0018f + s * 0.21f) % 1f + 1f) % 1f
                val spread = ((s - 2) * 9f + sin(frame.elapsedMs * 0.006 + s * 2.1).toFloat() * 3.5f) * frame.density
                val fx = crestX + spread
                val fy = row.baselineY - midHeight - jumpPx * 0.85f - life * 12f * frame.density +
                    abs(s - 2) * 2f * frame.density
                val alpha = sin(life * PI).toFloat() * 0.72f
                if (alpha > 0.03f) {
                    foamPaint.color = colorWithAlpha(style.crestColorArgb, alpha)
                    val radius = max(1f, 1.4f * frame.density * (1f - life * 0.35f))
                    canvas.drawCircle(fx, fy, radius, foamPaint)
                }
            }
        }
    }

    private fun rowCrestX(rowGlyphs: List<EffectGlyph>, localWaveIndex: Float, density: Float): Float {
        val n = rowGlyphs.size
        if (n == 0) return 0f
        if (localWaveIndex <= 0f) {
            val first = rowGlyphs.first()
            return first.x + first.width / 2f + localWaveIndex * max(14f * density, first.width)
        }
        if (localWaveIndex >= n - 1) {
            val last = rowGlyphs.last()
            return last.x + last.width / 2f + (localWaveIndex - (n - 1)) * max(14f * density, last.width)
        }
        val lo = floor(localWaveIndex).toInt().coerceIn(0, n - 2)
        val frac = localWaveIndex - lo
        val c0 = rowGlyphs[lo].x + rowGlyphs[lo].width / 2f
        val c1 = rowGlyphs[lo + 1].x + rowGlyphs[lo + 1].width / 2f
        return c0 * (1f - frac) + c1 * frac
    }

    internal data class WaveState(val waveIndex: Float, val lineModeLitLimit: Float)

    internal companion object {
        // 0.085 rad ≈ 4.87°
        const val MAX_TILT_DEG = 4.9f

        /**
         * 半径为 2 的平滑余弦波包络：
         * - distance = 0 -> 1.0 (波峰 100%)
         * - |distance| = 1 -> 0.5 (紧邻两侧精确半高 50%)
         * - |distance| >= 2 -> 0.0
         */
        fun waveHeight(distance: Float): Float {
            val absD = abs(distance)
            if (absD >= 2f) return 0f
            return 0.5f * (1f + cos(PI * absD / 2.0).toFloat())
        }

        fun computeWaveState(
            glyphs: List<EffectGlyph>,
            positionMs: Long,
            elapsedMs: Long,
            wordMode: Boolean,
        ): WaveState {
            val n = glyphs.size
            if (n == 0) return WaveState(-3f, -3f)

            if (!wordMode) {
                val sweepMs = max(1100L, n * 125L)
                val cycleMs = sweepMs + 520L
                val phase = ((elapsedMs % cycleMs) + cycleMs) % cycleMs
                val waveIndex = if (phase <= sweepMs) {
                    -2f + (n + 3.5f) * (phase.toFloat() / sweepMs.toFloat())
                } else {
                    n + 2f
                }
                val litLimit = if (elapsedMs >= sweepMs) {
                    n + 2f
                } else {
                    -2f + (n + 3.5f) * (elapsedMs.toFloat() / sweepMs.toFloat())
                }
                return WaveState(waveIndex, litLimit)
            }

            val firstStart = glyphs.first().startTimeMs
            val lastEnd = glyphs.last().endTimeMs
            val lineStartMs = positionMs - elapsedMs
            var waveIndex = -3f

            when {
                positionMs < firstStart -> {
                    val leadIn = (firstStart - lineStartMs).coerceIn(80L, 260L)
                    if (positionMs >= firstStart - leadIn) {
                        val u = (positionMs - (firstStart - leadIn)).toFloat() / leadIn.toFloat()
                        waveIndex = -2f + 1.5f * u
                    }
                }
                positionMs >= lastEnd -> {
                    val u = clampProgress((positionMs - lastEnd) / 280f)
                    waveIndex = (n - 0.5f) + 2.0f * u
                }
                else -> {
                    for (i in 0 until n) {
                        val glyph = glyphs[i]
                        if (positionMs < glyph.startTimeMs) {
                            waveIndex = i - 0.5f
                            break
                        }
                        if (positionMs < glyph.endTimeMs) {
                            waveIndex = i + (glyphProgress(glyph, positionMs) - 0.5f)
                            break
                        }
                    }
                }
            }
            return WaveState(waveIndex, n + 2f)
        }
    }
}
