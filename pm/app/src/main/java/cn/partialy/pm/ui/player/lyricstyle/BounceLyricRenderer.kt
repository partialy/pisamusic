package cn.partialy.pm.ui.player.lyricstyle

import android.graphics.Canvas
import kotlin.math.PI
import kotlin.math.sin

/**
 * 律动弹跳渲染器：
 * 围绕每个字素几何中心做正弦弹性跃起与放大，逐行模式下触发从左到右级联轻弹。
 */
internal class BounceLyricRenderer : LyricEffectRenderer {

    override fun extraVerticalPaddingPx(
        config: LyricEffectConfig,
        textSizePx: Float,
        density: Float,
    ): Float {
        val jumpPx = config.bounce.jumpHeightDp * density
        val scaleExtra = textSizePx * (config.bounce.jumpScale - 1f).coerceAtLeast(0f)
        return jumpPx * 1.4f + scaleExtra
    }

    override fun drawCurrentLine(canvas: Canvas, frame: LyricEffectRenderFrame) {
        val glyphs = frame.layout.glyphs
        if (glyphs.isEmpty()) return
        val style = frame.effectConfig.bounce
        val paint = frame.paint

        if (!frame.showProgress) {
            paint.clearShadowLayer()
            paint.color = style.unlitColorArgb
            for (run in frame.layout.runs) {
                canvas.drawText(run.text, run.x, run.baselineY, paint)
            }
            return
        }

        val jumpPx = style.jumpHeightDp * frame.density
        val midHeight = paint.textSize * 0.35f
        val glowRadius = 11f * frame.density

        glyphs.forEachIndexed { index, glyph ->
            var offsetY = 0f
            var scale = 1f
            var sung = 1f
            var active = 0f

            if (frame.wordMode) {
                val p = glyphProgress(glyph, frame.positionMs)
                sung = smoothProgress(p)
                if (p > 0f && p < 1f) {
                    val arc = sin(PI * p).toFloat()
                    offsetY = -jumpPx * arc
                    scale = 1f + (style.jumpScale - 1f) * arc
                    active = arc * arc
                }
            } else {
                val local = frame.elapsedMs - index * 32L
                if (local > 0L && local < 420L) {
                    val arc = sin(PI * (local / 420.0)).toFloat()
                    offsetY = -jumpPx * 0.85f * arc
                    scale = 1f + (style.jumpScale - 1f) * 0.65f * arc
                    active = arc * arc
                }
            }

            canvas.save()
            canvas.translate(glyph.x + glyph.width / 2f, glyph.baselineY - midHeight + offsetY)
            if (scale != 1f) canvas.scale(scale, scale)
            drawHighlightLayers(
                canvas = canvas,
                paint = paint,
                text = glyph.text,
                x = -glyph.width / 2f,
                baselineY = midHeight,
                baseColor = style.unlitColorArgb,
                sungColor = style.sungColorArgb,
                activeColor = style.activeColorArgb,
                sung = sung,
                active = active,
                glowColor = style.activeColorArgb,
                glowRadiusPx = glowRadius,
            )
            canvas.restore()
        }
    }
}
