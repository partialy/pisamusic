package cn.partialy.pm.ui.player.lyricstyle

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
import android.text.TextPaint
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * 聚光灯聚焦渲染器：
 * 切句入场时采用离屏模糊位图缓存与清晰字交叉混合（零每帧模糊开销），
 * 伴随字距收敛与当前字冰蓝聚光光晕。
 */
internal class SpotlightLyricRenderer : LyricEffectRenderer {
    private val bitmapPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val blurTextPaint = TextPaint(Paint.ANTI_ALIAS_FLAG)
    private var cachedBitmap: Bitmap? = null
    private var cachedLeft = 0f
    private var cachedTop = 0f
    private var cachedKey: BlurCacheKey? = null

    private data class BlurCacheKey(
        val text: String,
        val runCount: Int,
        val firstXBits: Int,
        val firstYBits: Int,
        val textSizeBits: Int,
        val bold: Boolean,
        val colorArgb: Int,
        val blurPxBits: Int,
    )

    override fun extraVerticalPaddingPx(
        config: LyricEffectConfig,
        textSizePx: Float,
        density: Float,
    ): Float {
        val scaleExtra = textSizePx * (config.spotlight.activeScale - 1f).coerceAtLeast(0f)
        return scaleExtra + config.spotlight.blurIntensityDp * density * 1.5f
    }

    override fun drawCurrentLine(canvas: Canvas, frame: LyricEffectRenderFrame) {
        val rows = frame.layout.rows
        if (rows.isEmpty()) return
        val style = frame.effectConfig.spotlight
        val paint = frame.paint

        if (!frame.showProgress) {
            paint.clearShadowLayer()
            paint.color = style.unlitColorArgb
            for (run in frame.layout.runs) {
                canvas.drawText(run.text, run.x, run.baselineY, paint)
            }
            return
        }

        val focusIn = smoothProgress(frame.elapsedMs / 340f)
        val clarity = focusIn
        val blurRadiusPx = style.blurIntensityDp * frame.density
        val blurAlpha = if (blurRadiusPx > 0.5f) (1f - clarity) * 0.9f else 0f

        if (blurAlpha > 0.02f) {
            val blurBmp = ensureBlurBitmap(frame, style.unlitColorArgb, blurRadiusPx)
            if (blurBmp != null) {
                bitmapPaint.alpha = (blurAlpha * 255f).roundToInt().coerceIn(0, 255)
                canvas.drawBitmap(blurBmp, cachedLeft, cachedTop, bitmapPaint)
            }
        }

        if (clarity <= 0.02f) return

        val midHeight = paint.textSize * 0.35f
        val baseSpreadPx = if (frame.layout.maxRowWidth > frame.maxTextWidth * 0.85f) {
            0f
        } else {
            (1f - focusIn) * 5f * frame.density
        }
        val glowRadiusPx = 14f * frame.density

        for (row in rows) {
            val chars = row.glyphs
            if (chars.isEmpty()) continue
            val middleIndex = (chars.size - 1) / 2f
            val rowSpread = min(baseSpreadPx, (36f * frame.density) / max(1, chars.size - 1))

            chars.forEachIndexed { index, glyph ->
                val p = if (frame.wordMode) glyphProgress(glyph, frame.positionMs) else 0f
                val active = if (frame.wordMode) {
                    highlightWeight(
                        frame.positionMs,
                        glyph.startTimeMs,
                        max(glyph.startTimeMs + 1L, glyph.endTimeMs),
                    )
                } else {
                    highlightWeight(frame.elapsedMs, 120L, 720L, 120f, 180f)
                }
                val sung = if (frame.wordMode) {
                    smoothProgress(p)
                } else {
                    smoothProgress((frame.elapsedMs - 120f) / 220f)
                }
                val scale = 1f + (style.activeScale - 1f) * active
                val alphaFactor = clarity * (1f - sung * (1f - active) * 0.1f)
                val spreadX = (index - middleIndex) * rowSpread

                canvas.save()
                canvas.translate(glyph.x + glyph.width / 2f + spreadX, glyph.baselineY - midHeight)
                if (scale != 1f) canvas.scale(scale, scale)
                drawHighlightLayers(
                    canvas = canvas,
                    paint = paint,
                    text = glyph.text,
                    x = -glyph.width / 2f,
                    baselineY = midHeight,
                    baseColor = colorWithAlpha(style.unlitColorArgb, alphaFactor),
                    sungColor = colorWithAlpha(style.sungColorArgb, alphaFactor),
                    activeColor = colorWithAlpha(style.activeColorArgb, alphaFactor),
                    sung = sung,
                    active = active,
                    glowColor = style.glowColorArgb,
                    glowRadiusPx = glowRadiusPx,
                )
                canvas.restore()
            }
        }
    }

    private fun ensureBlurBitmap(
        frame: LyricEffectRenderFrame,
        colorArgb: Int,
        blurRadiusPx: Float,
    ): Bitmap? {
        val runs = frame.layout.runs
        if (runs.isEmpty()) return null
        val first = runs.first()
        val key = BlurCacheKey(
            text = frame.line.lineText,
            runCount = runs.size,
            firstXBits = first.x.toRawBits(),
            firstYBits = first.baselineY.toRawBits(),
            textSizeBits = frame.paint.textSize.toRawBits(),
            bold = frame.paint.isFakeBoldText,
            colorArgb = colorArgb,
            blurPxBits = blurRadiusPx.toRawBits(),
        )
        if (key == cachedKey && cachedBitmap?.isRecycled == false) {
            return cachedBitmap
        }

        release()

        val fm = frame.paint.fontMetrics
        var minX = Float.MAX_VALUE
        var maxX = -Float.MAX_VALUE
        var minY = Float.MAX_VALUE
        var maxY = -Float.MAX_VALUE
        for (run in runs) {
            minX = min(minX, run.x)
            maxX = max(maxX, run.x + run.width)
            minY = min(minY, run.baselineY + fm.ascent)
            maxY = max(maxY, run.baselineY + fm.descent)
        }
        val pad = ceil(blurRadiusPx * 2.5f + 4f)
        val bmpW = ceil(maxX - minX + pad * 2f).toInt().coerceIn(1, 2048)
        val bmpH = ceil(maxY - minY + pad * 2f).toInt().coerceIn(1, 1024)

        val bmp = runCatching { Bitmap.createBitmap(bmpW, bmpH, Bitmap.Config.ARGB_8888) }.getOrNull()
            ?: return null
        val offscreen = Canvas(bmp)
        blurTextPaint.set(frame.paint)
        blurTextPaint.clearShadowLayer()
        blurTextPaint.shader = null
        blurTextPaint.color = colorArgb
        blurTextPaint.maskFilter = BlurMaskFilter(blurRadiusPx.coerceAtLeast(0.5f), BlurMaskFilter.Blur.NORMAL)

        val originLeft = minX - pad
        val originTop = minY - pad
        for (run in runs) {
            offscreen.drawText(run.text, run.x - originLeft, run.baselineY - originTop, blurTextPaint)
        }
        blurTextPaint.maskFilter = null

        cachedBitmap = bmp
        cachedLeft = originLeft
        cachedTop = originTop
        cachedKey = key
        return bmp
    }

    override fun release() {
        cachedBitmap?.recycle()
        cachedBitmap = null
        cachedKey = null
    }
}
