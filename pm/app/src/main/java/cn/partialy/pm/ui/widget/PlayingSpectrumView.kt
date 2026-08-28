package cn.partialy.pm.ui.widget

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.util.TypedValue
import android.view.View
import android.view.animation.LinearInterpolator
import kotlin.math.PI
import kotlin.math.sin

/** 当前歌曲封面上的三线频谱；仅选中歌曲显示，播放时错相跳动。 */
class PlayingSpectrumView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
    }
    private val barWidth = dp(2f)
    private val barGap = dp(4f)
    private val barRadius = dp(1f)
    private var selected = false
    private var playing = false
    private var animationProgress = 0f
    private var animator: ValueAnimator? = null

    /** 更新选中和播放状态；暂停仍保留静止频谱。 */
    fun setPlaybackState(selected: Boolean, isPlaying: Boolean) {
        this.selected = selected
        playing = isPlaying
        visibility = if (selected) VISIBLE else GONE
        synchronizeAnimation()
        invalidate()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        synchronizeAnimation()
    }

    override fun onDetachedFromWindow() {
        animator?.cancel()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (!selected || width <= 0 || height <= 0) return

        val totalBarsWidth = barWidth * BAR_COUNT + barGap * (BAR_COUNT - 1)
        val startX = (width - totalBarsWidth) / 2f
        repeat(BAR_COUNT) { index ->
            val barHeight = barHeight(index)
            val left = startX + index * (barWidth + barGap)
            val top = (height - barHeight) / 2f
            canvas.drawRoundRect(
                RectF(left, top, left + barWidth, top + barHeight),
                barRadius,
                barRadius,
                paint,
            )
        }
    }

    private fun synchronizeAnimation() {
        if (!isAttachedToWindow || !selected || !playing) {
            animator?.cancel()
            return
        }
        val runningAnimator = animator ?: ValueAnimator.ofFloat(0f, 1f).apply {
            duration = ANIMATION_DURATION_MS
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener {
                animationProgress = it.animatedValue as Float
                invalidate()
            }
            animator = this
        }
        if (!runningAnimator.isRunning) runningAnimator.start()
    }

    private fun barHeight(index: Int): Float {
        val minimum = height * MIN_BAR_RATIO
        if (!playing) return height * STATIC_BAR_RATIOS[index]

        val wave = ((sin((animationProgress + BAR_PHASES[index]) * 2f * PI) + 1f) / 2f).toFloat()
        return minimum + (height * MAX_BAR_RATIO - minimum) * wave
    }

    private fun dp(value: Float): Float = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        value,
        resources.displayMetrics,
    )

    private companion object {
        const val BAR_COUNT = 3
        const val ANIMATION_DURATION_MS = 700L
        const val MIN_BAR_RATIO = 0.36f
        const val MAX_BAR_RATIO = 0.88f
        val BAR_PHASES = floatArrayOf(0f, 0.33f, 0.66f)
        val STATIC_BAR_RATIOS = floatArrayOf(0.46f, 0.72f, 0.56f)
    }
}
