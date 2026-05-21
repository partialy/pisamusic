package cn.partialy.pm.ui.player

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.text.TextPaint
import android.text.TextUtils
import android.util.AttributeSet
import android.view.View
import cn.partialy.pm.lyric.LyricLine
import kotlin.math.max
import kotlin.math.roundToInt

class KaraokeLyricsView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {
    private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.LEFT
    }
    private var lines: List<LyricLine> = emptyList()
    private var currentIndex: Int = -1
    private var positionMs: Long = 0L
    private var style: LyricDisplayStyle = LyricDisplayStyle.DEFAULT

    fun bind(
        lines: List<LyricLine>,
        currentIndex: Int,
        positionMs: Long,
        style: LyricDisplayStyle,
    ) {
        val oldSize = this.style.textSizeSp
        this.lines = lines
        this.currentIndex = currentIndex
        this.positionMs = positionMs
        this.style = style
        if (oldSize != style.textSizeSp) requestLayout()
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (lines.isEmpty() || currentIndex !in lines.indices) return
        val maxTextWidth = (width - paddingLeft - paddingRight).coerceAtLeast(0)
        if (maxTextWidth <= 0) return

        val currentTextSize = currentTextSizePx()
        val normalTextSize = normalTextSizePx()
        val rowGap = dp(14f)
        val currentLineHeight = textHeight(currentTextSize)
        val normalLineHeight = textHeight(normalTextSize)
        val rowStride = max(currentLineHeight, normalLineHeight) + rowGap
        val centerBaseline = height / 2f - textCenterOffset(currentTextSize)
        val visibleRadius = max(1, (height / rowStride).roundToInt() / 2 + 1)
        val first = (currentIndex - visibleRadius).coerceAtLeast(0)
        val last = (currentIndex + visibleRadius).coerceAtMost(lines.lastIndex)

        for (index in first..last) {
            val isCurrent = index == currentIndex
            paint.textSize = if (isCurrent) currentTextSize else normalTextSize
            paint.isFakeBoldText = isCurrent && style.currentLineBold
            paint.color = if (isCurrent) currentBaseColor() else style.resolvedNormalColor()

            val baseline = centerBaseline + (index - currentIndex) * rowStride
            val displayText = ellipsize(lines[index].lineText, maxTextWidth)
            if (displayText.isBlank()) continue
            val x = lineX(displayText, maxTextWidth)
            canvas.drawText(displayText, x, baseline, paint)

            if (isCurrent && lines[index].hasWordTiming) {
                drawSungPart(canvas, lines[index], displayText, x, baseline)
            }
        }
    }

    private fun drawSungPart(
        canvas: Canvas,
        line: LyricLine,
        displayText: String,
        x: Float,
        baseline: Float,
    ) {
        val sungWidth = calculateSungWidth(line, displayText)
        if (sungWidth <= 0f) return
        canvas.save()
        canvas.clipRect(x, 0f, x + sungWidth.coerceAtMost(paint.measureText(displayText)), height.toFloat())
        paint.color = style.currentColorArgb
        canvas.drawText(displayText, x, baseline, paint)
        canvas.restore()
    }

    private fun calculateSungWidth(line: LyricLine, displayText: String): Float {
        var visibleChars = 0
        var width = 0f
        for (word in line.words) {
            if (visibleChars >= displayText.length) break
            val text = word.word.take(displayText.length - visibleChars)
            if (text.isEmpty()) continue
            val wordWidth = paint.measureText(text)
            width += when {
                positionMs >= word.endTime -> wordWidth
                positionMs <= word.startTime -> 0f
                else -> {
                    val duration = (word.endTime - word.startTime).coerceAtLeast(1L)
                    val elapsed = (positionMs - word.startTime).coerceIn(0L, duration)
                    wordWidth * (elapsed.toFloat() / duration.toFloat())
                }
            }
            visibleChars += text.length
        }
        return width
    }

    private fun ellipsize(text: String, maxTextWidth: Int): String =
        TextUtils.ellipsize(
            text,
            paint,
            maxTextWidth.toFloat(),
            TextUtils.TruncateAt.END,
        ).toString()

    private fun lineX(text: String, maxTextWidth: Int): Float {
        val textWidth = paint.measureText(text)
        return when (style.alignment) {
            LyricAlignment.START -> paddingLeft.toFloat()
            LyricAlignment.CENTER -> paddingLeft + (maxTextWidth - textWidth) / 2f
            LyricAlignment.END -> width - paddingRight - textWidth
        }
    }

    private fun textHeight(textSize: Float): Float {
        paint.textSize = textSize
        return paint.fontMetrics.run { descent - ascent }
    }

    private fun textCenterOffset(textSize: Float): Float {
        paint.textSize = textSize
        return (paint.ascent() + paint.descent()) / 2f
    }

    private fun currentTextSizePx(): Float =
        sp(
            if (style.currentLineEnlarged) {
                style.textSizeSp + style.currentLineEnlargedDxSp
            } else {
                style.textSizeSp
            },
        )

    private fun normalTextSizePx(): Float = sp(style.textSizeSp)

    private fun currentBaseColor(): Int =
        Color.argb(
            255,
            Color.red(style.normalColorArgb),
            Color.green(style.normalColorArgb),
            Color.blue(style.normalColorArgb),
        )

    private fun dp(value: Float): Float = value * resources.displayMetrics.density

    private fun sp(value: Float): Float = value * resources.displayMetrics.scaledDensity
}
