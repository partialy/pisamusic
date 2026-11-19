package cn.partialy.pm.ui.player.lyricstyle

import android.graphics.Canvas
import android.graphics.Paint
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max

/**
 * 打字机逐现渲染器：
 * 逐字模式严格跟随字时间戳弹出；逐行模式按 lineRevealDurationMs 匀速打出并带呼吸光标。
 */
internal class TypewriterLyricRenderer : LyricEffectRenderer {
    private val cursorPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    override fun drawCurrentLine(canvas: Canvas, frame: LyricEffectRenderFrame) {
        val chars = frame.layout.glyphs
        if (chars.isEmpty()) return
        val style = frame.effectConfig.typewriter
        val paint = frame.paint

        if (!frame.showProgress) {
            paint.clearShadowLayer()
            paint.color = style.textColorArgb
            for (run in frame.layout.runs) {
                canvas.drawText(run.text, run.x, run.baselineY, paint)
            }
            return
        }

        val revealMs = style.lineRevealDurationMs.coerceAtLeast(100).toFloat()
        val count = chars.size
        var latestIndex = -1
        for (i in 0 until count) {
            val glyphElapsed = if (frame.wordMode) {
                (frame.positionMs - chars[i].startTimeMs).toFloat()
            } else {
                frame.elapsedMs - i * revealMs / count
            }
            if (glyphElapsed >= 0f) latestIndex = i
        }

        val timeline = if (frame.wordMode) frame.positionMs else frame.elapsedMs
        val finishAt = if (frame.wordMode) {
            chars.last().endTimeMs + 140L
        } else {
            (revealMs + 320f).toLong()
        }
        val cursorFade = 1f - smoothProgress((timeline - finishAt) / 140f)
        val midHeight = paint.textSize * 0.35f
        val popOffsetPx = 4.5f * frame.density

        for (i in 0..latestIndex) {
            val glyph = chars[i]
            val glyphElapsed = if (frame.wordMode) {
                (frame.positionMs - glyph.startTimeMs).toFloat()
            } else {
                frame.elapsedMs - i * revealMs / count
            }
            val pop = easeOutCubic(glyphElapsed / 140f)
            val startAt = if (frame.wordMode) glyph.startTimeMs else (i * revealMs / count).toLong()
            val nextAt = if (i + 1 < count) {
                if (frame.wordMode) chars[i + 1].startTimeMs else ((i + 1) * revealMs / count).toLong()
            } else {
                finishAt
            }
            val active = highlightWeight(timeline, startAt, max(startAt + 1L, nextAt), 60f, 140f)
            val scale = 0.88f + 0.12f * pop
            val offsetY = (1f - pop) * popOffsetPx

            canvas.save()
            canvas.translate(glyph.x + glyph.width / 2f, glyph.baselineY - midHeight + offsetY)
            canvas.scale(scale, scale)
            val baseWithPop = colorWithAlpha(style.textColorArgb, pop)
            val glowWithPop = colorWithAlpha(style.latestGlowColorArgb, pop)
            drawHighlightLayers(
                canvas = canvas,
                paint = paint,
                text = glyph.text,
                x = -glyph.width / 2f,
                baselineY = midHeight,
                baseColor = baseWithPop,
                sungColor = baseWithPop,
                activeColor = glowWithPop,
                sung = 1f,
                active = active,
                glowColor = style.latestGlowColorArgb,
                glowRadiusPx = 10f * frame.density,
            )
            canvas.restore()
        }

        if (style.showCursor && cursorFade > 0.01f) {
            val latest = chars.getOrNull(latestIndex)
            val anchorGlyph = latest ?: chars.first()
            val cursorX = if (latest != null) latest.x + latest.width + 3f * frame.density else anchorGlyph.x
            val cursorH = (paint.textSize * 0.86f).coerceAtLeast(12f * frame.density)
            val cursorW = 2.2f * frame.density
            val blink = 0.25f + 0.75f * (0.5f + 0.5f * cos(frame.elapsedMs / 750.0 * PI * 2.0).toFloat())
            val alpha = (cursorFade * blink).coerceIn(0f, 1f)
            val top = anchorGlyph.baselineY - cursorH * 0.84f

            cursorPaint.color = colorWithAlpha(style.latestGlowColorArgb, alpha)
            cursorPaint.setShadowLayer(8f * frame.density, 0f, 0f, colorWithAlpha(style.latestGlowColorArgb, alpha))
            canvas.drawRoundRect(
                cursorX,
                top,
                cursorX + cursorW,
                top + cursorH,
                cursorW * 0.5f,
                cursorW * 0.5f,
                cursorPaint,
            )
            cursorPaint.clearShadowLayer()
        }
    }
}
