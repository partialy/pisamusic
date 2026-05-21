package cn.partialy.pm.statusbarlyric

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.text.TextPaint
import android.text.TextUtils
import android.util.AttributeSet
import android.view.View
import cn.partialy.pm.lyric.LyricLine
import kotlin.math.roundToInt

class StatusBarLyricView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {
    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(46, 30, 144, 255)
    }
    private val backgroundRect = RectF()
    private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.LEFT
        isFakeBoldText = true
    }
    private var lyricText = ""
    private var lyricLine: LyricLine? = null
    private var positionMs: Long = 0L
    private var useWordProgress = false
    private var lineIndex = -1
    private var displayProgress = 0f
    private var sungColor = StatusBarLyricPrefs.DEFAULT.sungColorArgb
    private var unsungColor = StatusBarLyricPrefs.DEFAULT.unsungColorArgb
    private var fontSizeSp = StatusBarLyricPrefs.fontSizeSp(StatusBarLyricPrefs.DEFAULT.fontSizeLevel)
    private var animationStartProgress = 0f
    private var animationMaxProgress = 0f
    private var animationDurationMs = 0L
    private var animationStartAtMs = 0L
    private var animationStopAtMs = 0L
    private var animationRunning = false
    private var boundsVisibleUntilMs = 0L

    fun bind(
        config: StatusBarLyricConfig,
        index: Int,
        line: LyricLine,
        positionMs: Long,
        useWordProgress: Boolean,
        lineProgress: Float,
        elapsedMs: Long,
        durationMs: Long,
    ) {
        val previousFontSize = fontSizeSp
        lyricText = line.lineText
        lyricLine = line
        this.positionMs = positionMs
        this.useWordProgress = useWordProgress
        lineIndex = index
        sungColor = config.sungColorArgb
        unsungColor = config.unsungColorArgb
        fontSizeSp = StatusBarLyricPrefs.fontSizeSp(config.fontSizeLevel)
        paint.textSize = sp(fontSizeSp)
        if (previousFontSize != fontSizeSp) requestLayout()

        startBoundedLinearProgress(
            initialProgress = lineProgress.coerceIn(0f, 1f),
            elapsedMs = elapsedMs,
            durationMs = durationMs,
        )
    }

    fun bindStaticPreview(config: StatusBarLyricConfig, text: String, progress: Float) {
        val previousFontSize = fontSizeSp
        lyricText = text
        lyricLine = null
        useWordProgress = false
        lineIndex = PREVIEW_LINE_INDEX
        sungColor = config.sungColorArgb
        unsungColor = config.unsungColorArgb
        fontSizeSp = StatusBarLyricPrefs.fontSizeSp(config.fontSizeLevel)
        paint.textSize = sp(fontSizeSp)
        displayProgress = progress.coerceIn(0f, 1f)
        animationRunning = false
        if (previousFontSize != fontSizeSp) requestLayout()
        invalidate()
    }

    fun showBounds(durationMs: Long = BOUNDS_VISIBLE_MS) {
        boundsVisibleUntilMs = SystemClock.uptimeMillis() + durationMs.coerceAtLeast(0L)
        invalidate()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        paint.textSize = sp(fontSizeSp)
        val desiredHeight = (paint.fontMetrics.run { descent - ascent } + dp(8f)).roundToInt()
        val measuredWidth = MeasureSpec.getSize(widthMeasureSpec)
        setMeasuredDimension(measuredWidth, resolveSize(desiredHeight, heightMeasureSpec))
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        updateAnimatedProgress()
        drawBoundsIfNeeded(canvas)
        val maxTextWidth = (width - paddingLeft - paddingRight).coerceAtLeast(0)
        if (maxTextWidth <= 0 || lyricText.isBlank()) return

        paint.textSize = sp(fontSizeSp)
        val displayText = TextUtils.ellipsize(
            lyricText,
            paint,
            maxTextWidth.toFloat(),
            TextUtils.TruncateAt.END,
        ).toString()
        val textWidth = paint.measureText(displayText)
        val x = paddingLeft + (maxTextWidth - textWidth) / 2f
        val baseline = height / 2f - (paint.ascent() + paint.descent()) / 2f

        paint.color = unsungColor
        canvas.drawText(displayText, x, baseline, paint)

        val sungWidth = if (useWordProgress) {
            calculateWordSungWidth(displayText)
        } else {
            textWidth * displayProgress
        }
        if (sungWidth > 0f) {
            canvas.save()
            canvas.clipRect(x, 0f, x + sungWidth, height.toFloat())
            paint.color = sungColor
            canvas.drawText(displayText, x, baseline, paint)
            canvas.restore()
        }

        if (animationRunning || isBoundsVisible()) postInvalidateOnAnimation()
    }

    override fun onDetachedFromWindow() {
        animationRunning = false
        super.onDetachedFromWindow()
    }

    private fun startBoundedLinearProgress(initialProgress: Float, elapsedMs: Long, durationMs: Long) {
        val safeDuration = durationMs.coerceAtLeast(1L)
        val windowMs = minOf(SYNC_WINDOW_MS, (safeDuration - elapsedMs).coerceAtLeast(0L))
        val maxProgress = ((elapsedMs + windowMs).toFloat() / safeDuration.toFloat()).coerceIn(0f, 1f)

        displayProgress = initialProgress.coerceIn(0f, 1f)
        animationStartProgress = displayProgress
        animationMaxProgress = maxProgress.coerceAtLeast(animationStartProgress)
        animationDurationMs = safeDuration
        animationStartAtMs = SystemClock.uptimeMillis()
        animationStopAtMs = animationStartAtMs + windowMs
        animationRunning = windowMs > 0L && animationStartProgress < animationMaxProgress

        if (!animationRunning) {
            invalidate()
            return
        }
        postInvalidateOnAnimation()
    }

    private fun updateAnimatedProgress() {
        if (!animationRunning) return
        if (useWordProgress) {
            val elapsedWallMs = (SystemClock.uptimeMillis() - animationStartAtMs).coerceAtLeast(0L)
            positionMs += elapsedWallMs
            animationStartAtMs = SystemClock.uptimeMillis()
            if (SystemClock.uptimeMillis() >= animationStopAtMs || positionMs >= (lyricLine?.endTime ?: positionMs)) {
                animationRunning = false
            }
            return
        }
        val elapsedWallMs = (SystemClock.uptimeMillis() - animationStartAtMs).coerceAtLeast(0L)
        val advanced = elapsedWallMs.toFloat() / animationDurationMs.toFloat()
        displayProgress = (animationStartProgress + advanced).coerceAtMost(animationMaxProgress)
        if (displayProgress >= animationMaxProgress) {
            animationRunning = false
        }
    }

    private fun drawBoundsIfNeeded(canvas: Canvas) {
        if (!isBoundsVisible()) return
        val inset = dp(1f)
        backgroundRect.set(inset, inset, width - inset, height - inset)
        canvas.drawRoundRect(backgroundRect, dp(8f), dp(8f), backgroundPaint)
    }

    private fun isBoundsVisible(): Boolean = SystemClock.uptimeMillis() < boundsVisibleUntilMs

    private fun calculateWordSungWidth(displayText: String): Float {
        val line = lyricLine ?: return 0f
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

    private companion object {
        private const val SYNC_WINDOW_MS = 1_000L
        private const val BOUNDS_VISIBLE_MS = 2_000L
        private const val PREVIEW_LINE_INDEX = -1
    }
}
