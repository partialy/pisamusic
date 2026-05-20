package cn.partialy.pm.statusbarlyric

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.os.SystemClock
import android.text.TextPaint
import android.text.TextUtils
import android.util.AttributeSet
import android.view.View
import kotlin.math.roundToInt

class StatusBarLyricView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {
    private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.LEFT
        isFakeBoldText = true
    }
    private var lyricText = ""
    private var lineIndex = -1
    private var displayProgress = 0f
    private var sungColor = StatusBarLyricPrefs.DEFAULT.sungColorArgb
    private var unsungColor = StatusBarLyricPrefs.DEFAULT.unsungColorArgb
    private var fontSizeSp = StatusBarLyricPrefs.fontSizeSp(StatusBarLyricPrefs.DEFAULT.fontSizeLevel)
    private var animationStartProgress = 0f
    private var animationMaxProgress = 0f
    private var animationDurationMs = 0L
    private var animationStartAtMs = 0L
    private var animationRunning = false

    fun bind(
        config: StatusBarLyricConfig,
        index: Int,
        text: String,
        lineProgress: Float,
        elapsedMs: Long,
        durationMs: Long,
    ) {
        val previousFontSize = fontSizeSp
        lyricText = text
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

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        paint.textSize = sp(fontSizeSp)
        val desiredHeight = (paint.fontMetrics.run { descent - ascent } + dp(8f)).roundToInt()
        val measuredWidth = MeasureSpec.getSize(widthMeasureSpec)
        setMeasuredDimension(measuredWidth, resolveSize(desiredHeight, heightMeasureSpec))
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        updateAnimatedProgress()
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

        val sungWidth = textWidth * displayProgress
        if (sungWidth <= 0f) return
        canvas.save()
        canvas.clipRect(x, 0f, x + sungWidth, height.toFloat())
        paint.color = sungColor
        canvas.drawText(displayText, x, baseline, paint)
        canvas.restore()

        if (animationRunning) postInvalidateOnAnimation()
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
        animationRunning = windowMs > 0L && animationStartProgress < animationMaxProgress

        if (!animationRunning) {
            invalidate()
            return
        }
        postInvalidateOnAnimation()
    }

    private fun updateAnimatedProgress() {
        if (!animationRunning) return
        val elapsedWallMs = (SystemClock.uptimeMillis() - animationStartAtMs).coerceAtLeast(0L)
        val advanced = elapsedWallMs.toFloat() / animationDurationMs.toFloat()
        displayProgress = (animationStartProgress + advanced).coerceAtMost(animationMaxProgress)
        if (displayProgress >= animationMaxProgress) {
            animationRunning = false
        }
    }

    private fun dp(value: Float): Float = value * resources.displayMetrics.density

    private fun sp(value: Float): Float = value * resources.displayMetrics.scaledDensity

    private companion object {
        private const val SYNC_WINDOW_MS = 1_000L
    }
}
