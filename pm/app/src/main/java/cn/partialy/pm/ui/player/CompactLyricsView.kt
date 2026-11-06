package cn.partialy.pm.ui.player

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import android.text.TextPaint
import android.text.TextUtils
import android.util.AttributeSet
import android.view.View
import cn.partialy.pm.lyric.LyricContent
import cn.partialy.pm.lyric.LyricLine
import kotlin.math.PI
import kotlin.math.sin

/** 仅绘制外部提供的播放快照，不注册播放器观察者或独立动画时钟。 */
class CompactLyricsView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {
    private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG)
    private val maskPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
    }
    private var lines: List<LyricLine> = emptyList()
    private var currentIndex = -1
    private var positionMs = 0L
    private var style = LyricDisplayStyle.DEFAULT
    private var animate = true
    private var offsetPx = 0f
    private var useWordTiming = true
    private var fadeShader: Shader? = null
    private var fadeLeft = Float.NaN
    private var fadeRight = Float.NaN

    fun bind(content: LyricContent, positionMs: Long, isPlaying: Boolean, style: LyricDisplayStyle,
             animateTransitions: Boolean = true, useWordTiming: Boolean = true) = bind(content.displayLines,
        CompactLyricRules.currentIndex(content.displayLines, positionMs), positionMs, isPlaying, style, animateTransitions, useWordTiming)

    fun bind(lines: List<LyricLine>, currentIndex: Int, positionMs: Long, isPlaying: Boolean,
             style: LyricDisplayStyle, animateTransitions: Boolean = true, useWordTiming: Boolean = true) {
        val changed = this.lines !== lines || this.currentIndex != currentIndex
        val moved = this.positionMs != positionMs
        val resized = this.style.textSizeSp != style.textSizeSp ||
            this.style.currentLineEnlargedDxSp != style.currentLineEnlargedDxSp ||
            this.style.currentLineEnlarged != style.currentLineEnlarged
        this.lines = lines
        this.currentIndex = currentIndex
        this.positionMs = positionMs
        this.style = style
        animate = animateTransitions
        this.useWordTiming = useWordTiming
        // 暂停时外部重复快照不改变偏移；暂停期间 Seek 仍按新媒体时间重算。
        if (changed || moved || resized || isPlaying) offsetPx = Float.NaN
        contentDescription = lines.getOrNull(currentIndex)?.lineText.orEmpty()
        if (resized) requestLayout()
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        offsetPx = Float.NaN
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        paint.textSize = currentSize()
        val row = paint.fontMetrics.run { descent - ascent } + dp(10f)
        setMeasuredDimension(resolveSize(suggestedMinimumWidth, widthMeasureSpec),
            resolveSize((row * 3 + paddingTop + paddingBottom).toInt(), heightMeasureSpec))
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val available = (width - paddingLeft - paddingRight).toFloat()
        if (available <= 0 || currentIndex !in lines.indices) return
        val row = (height - paddingTop - paddingBottom) / 3f
        for (relative in -1..1) {
            val line = lines.getOrNull(currentIndex + relative) ?: continue
            val selected = relative == 0
            paint.textSize = if (selected) currentSize() else sp(style.textSizeSp)
            paint.isFakeBoldText = selected && style.currentLineBold
            val text = if (selected) line.lineText else
                TextUtils.ellipsize(line.lineText, paint, available, TextUtils.TruncateAt.END).toString()
            val baseline = paddingTop + (relative + 1.5f) * row - (paint.ascent() + paint.descent()) / 2
            val textWidth = paint.measureText(text)
            val overflow = (textWidth - available).coerceAtLeast(0f)
            if (selected && (offsetPx.isNaN() || !animate || !ValueAnimator.areAnimatorsEnabled())) {
                val end = lines.getOrNull(currentIndex + 1)?.startTime?.takeIf { it > line.startTime }
                    ?: line.endTime
                offsetPx = if (animate && ValueAnimator.areAnimatorsEnabled())
                    CompactLyricRules.horizontalOffset(overflow, resources.displayMetrics.density,
                        positionMs - line.startTime, end - line.startTime) else 0f
            }
            val origin = if (overflow > 0) paddingLeft.toFloat() else if (selected) paddingLeft + (available - textWidth) / 2f else when (style.alignment) {
                LyricAlignment.START -> paddingLeft.toFloat()
                LyricAlignment.CENTER -> paddingLeft + (available - textWidth) / 2f
                LyricAlignment.END -> width - paddingRight - textWidth
            }
            val x = origin - if (selected) offsetPx else 0f
            val layer = canvas.saveLayer(paddingLeft.toFloat(), paddingTop + (relative + 1) * row,
                width - paddingRight.toFloat(), paddingTop + (relative + 2) * row, null)
            canvas.clipRect(paddingLeft.toFloat(), paddingTop + (relative + 1) * row,
                width - paddingRight.toFloat(), paddingTop + (relative + 2) * row)
            paint.color = if (!selected) style.resolvedNormalColor() else
                if (useWordTiming && line.hasWordTiming) style.normalColorArgb else style.currentColorArgb
            drawLine(canvas, line, text, x, baseline, selected)
            if (selected && useWordTiming && line.hasWordTiming) {
                val sung = line.words.sumOf { (paint.measureText(it.word) * CompactLyricRules.wordProgress(it, positionMs)).toDouble() }.toFloat()
                canvas.save()
                canvas.clipRect(x, 0f, x + sung, height.toFloat())
                paint.color = style.currentColorArgb
                drawLine(canvas, line, text, x, baseline, selected = true)
                canvas.restore()
            }
            if (selected && overflow > 0) {
                val left = paddingLeft.toFloat()
                val right = width - paddingRight.toFloat()
                if (fadeShader == null || fadeLeft != left || fadeRight != right) {
                    val fade = dp(16f).coerceAtMost(available / 2f)
                    fadeShader = LinearGradient(left, 0f, right, 0f,
                        intArrayOf(Color.TRANSPARENT, Color.BLACK, Color.BLACK, Color.TRANSPARENT),
                        floatArrayOf(0f, fade / available, 1f - fade / available, 1f), Shader.TileMode.CLAMP)
                    fadeLeft = left
                    fadeRight = right
                }
                maskPaint.shader = fadeShader
                canvas.drawRect(left, paddingTop + (relative + 1) * row, right,
                    paddingTop + (relative + 2) * row, maskPaint)
            }
            canvas.restoreToCount(layer)
        }
    }

    private fun drawLine(canvas: Canvas, line: LyricLine, text: String, x: Float, baseline: Float, selected: Boolean) {
        if (!selected || !useWordTiming || !style.wordScaleEnabled || !line.hasWordTiming || !animate || !ValueAnimator.areAnimatorsEnabled()) {
            canvas.drawText(text, x, baseline, paint)
            return
        }
        var cursor = x
        line.words.forEach { word ->
            val wordWidth = paint.measureText(word.word)
            val active = positionMs >= word.startTime && positionMs < word.endTime
            canvas.save()
            if (active) {
                val progress = CompactLyricRules.wordProgress(word, positionMs)
                val scale = 1f + .14f * sin(progress * PI).toFloat()
                canvas.scale(scale, scale, cursor + wordWidth / 2, baseline)
            }
            canvas.drawText(word.word, cursor, baseline, paint)
            canvas.restore()
            cursor += wordWidth
        }
    }

    private fun currentSize() = sp(style.textSizeSp + if (style.currentLineEnlarged) style.currentLineEnlargedDxSp else 0)
    private fun dp(value: Float) = value * resources.displayMetrics.density
    private fun sp(value: Float) = value * resources.displayMetrics.scaledDensity
}
