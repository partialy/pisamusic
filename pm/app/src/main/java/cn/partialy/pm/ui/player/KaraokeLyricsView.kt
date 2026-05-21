package cn.partialy.pm.ui.player

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.text.TextPaint
import android.text.TextUtils
import android.util.AttributeSet
import android.view.View
import cn.partialy.pm.lyric.LyricLine
import kotlin.math.roundToInt

class KaraokeLyricsView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {
    private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.LEFT
        isFakeBoldText = true
    }
    private var line: LyricLine? = null
    private var positionMs: Long = 0L
    private var style: LyricDisplayStyle = LyricDisplayStyle.DEFAULT

    fun bind(line: LyricLine?, positionMs: Long, style: LyricDisplayStyle) {
        val oldSize = this.style.textSizeSp
        this.line = line
        this.positionMs = positionMs
        this.style = style
        paint.textSize = sp(style.textSizeSp + style.currentLineEnlargedDxSp)
        if (oldSize != style.textSizeSp) requestLayout()
        invalidate()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        paint.textSize = sp(style.textSizeSp + style.currentLineEnlargedDxSp)
        val desiredHeight = (paint.fontMetrics.run { descent - ascent } + dp(24f)).roundToInt()
        setMeasuredDimension(
            MeasureSpec.getSize(widthMeasureSpec),
            resolveSize(desiredHeight, heightMeasureSpec),
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val current = line ?: return
        val maxTextWidth = (width - paddingLeft - paddingRight).coerceAtLeast(0)
        if (maxTextWidth <= 0) return

        paint.textSize = sp(style.textSizeSp + style.currentLineEnlargedDxSp)
        paint.isFakeBoldText = style.currentLineBold
        val displayText = TextUtils.ellipsize(
            current.lineText,
            paint,
            maxTextWidth.toFloat(),
            TextUtils.TruncateAt.END,
        ).toString()
        if (displayText.isBlank()) return

        val textWidth = paint.measureText(displayText)
        val x = when (style.alignment) {
            LyricAlignment.START -> paddingLeft.toFloat()
            LyricAlignment.CENTER -> paddingLeft + (maxTextWidth - textWidth) / 2f
            LyricAlignment.END -> width - paddingRight - textWidth
        }
        val baseline = height / 2f - (paint.ascent() + paint.descent()) / 2f

        paint.color = style.resolvedNormalColor()
        canvas.drawText(displayText, x, baseline, paint)

        val sungWidth = calculateSungWidth(current, displayText)
        if (sungWidth <= 0f) return
        canvas.save()
        canvas.clipRect(x, 0f, x + sungWidth.coerceAtMost(textWidth), height.toFloat())
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

    private fun dp(value: Float): Float = value * resources.displayMetrics.density

    private fun sp(value: Float): Float = value * resources.displayMetrics.scaledDensity
}
