package cn.partialy.pm.ui.player.lyricstyle

import android.graphics.Canvas
import android.graphics.Color
import android.text.TextPaint
import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.ui.player.LyricDisplayStyle
import kotlin.math.roundToInt

internal data class LyricEffectRenderFrame(
    val line: LyricLine,
    val layout: EffectLineLayout,
    val paint: TextPaint,
    val displayStyle: LyricDisplayStyle,
    val effectConfig: LyricEffectConfig,
    val positionMs: Long,
    val elapsedMs: Long,
    val durationMs: Long,
    val wordMode: Boolean,
    val showProgress: Boolean,
    val centerBaseline: Float,
    val maxTextWidth: Int,
    val viewWidth: Int,
    val viewHeight: Int,
    val paddingLeft: Int,
    val paddingRight: Int,
    val wrappedLineGapPx: Float,
    val density: Float,
)

internal interface LyricEffectRenderer {
    fun drawCurrentLine(canvas: Canvas, frame: LyricEffectRenderFrame)

    /** 动效向上跃起或底部装饰线所需的额外垂直空间（px），防止与相邻行重叠。 */
    fun extraVerticalPaddingPx(config: LyricEffectConfig, textSizePx: Float, density: Float): Float = 0f

    fun release() {}
}

internal fun clampProgress(value: Float): Float = value.coerceIn(0f, 1f)

internal fun smoothProgress(value: Float): Float {
    val t = clampProgress(value)
    return t * t * (3f - 2f * t)
}

internal fun easeOutCubic(value: Float): Float {
    val t = 1f - clampProgress(value)
    return 1f - t * t * t
}

internal fun glyphProgress(glyph: EffectGlyph, positionMs: Long): Float {
    val dur = (glyph.endTimeMs - glyph.startTimeMs).coerceAtLeast(1L)
    return clampProgress((positionMs - glyph.startTimeMs).toFloat() / dur.toFloat())
}

internal fun runProgress(run: EffectRun, positionMs: Long): Float {
    val dur = (run.endTimeMs - run.startTimeMs).coerceAtLeast(1L)
    return clampProgress((positionMs - run.startTimeMs).toFloat() / dur.toFloat())
}

internal fun highlightWeight(
    timeMs: Long,
    startMs: Long,
    endMs: Long,
    attackMs: Float = 90f,
    releaseMs: Float = 140f,
): Float {
    val attack = attackMs.coerceAtMost(((endMs - startMs).coerceAtLeast(1L) / 2f)).coerceAtLeast(1f)
    val enter = smoothProgress((timeMs - startMs) / attack)
    val leave = 1f - smoothProgress((timeMs - endMs) / releaseMs.coerceAtLeast(1f))
    return enter * leave
}

internal fun colorWithAlpha(argb: Int, alphaMultiplier: Float): Int {
    val baseAlpha = Color.alpha(argb)
    val nextAlpha = (baseAlpha * alphaMultiplier.coerceIn(0f, 1f)).roundToInt().coerceIn(0, 255)
    return Color.argb(nextAlpha, Color.red(argb), Color.green(argb), Color.blue(argb))
}

internal fun drawHighlightLayers(
    canvas: Canvas,
    paint: TextPaint,
    text: String,
    x: Float,
    baselineY: Float,
    baseColor: Int,
    sungColor: Int,
    activeColor: Int,
    sung: Float,
    active: Float,
    glowColor: Int,
    glowRadiusPx: Float,
) {
    val s = sung.coerceIn(0f, 1f)
    val a = active.coerceIn(0f, 1f)

    val wBase = (1f - s) * (1f - a)
    if (wBase > 0.01f) {
        paint.clearShadowLayer()
        paint.color = colorWithAlpha(baseColor, wBase)
        canvas.drawText(text, x, baselineY, paint)
    }

    val wSung = s * (1f - a)
    if (wSung > 0.01f) {
        paint.clearShadowLayer()
        paint.color = colorWithAlpha(sungColor, wSung)
        canvas.drawText(text, x, baselineY, paint)
    }

    if (a > 0.01f) {
        if (glowRadiusPx > 0.5f) {
            paint.setShadowLayer(glowRadiusPx, 0f, 0f, colorWithAlpha(glowColor, a))
        } else {
            paint.clearShadowLayer()
        }
        paint.color = colorWithAlpha(activeColor, a)
        canvas.drawText(text, x, baselineY, paint)
        paint.clearShadowLayer()
    }
}
