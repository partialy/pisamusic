package cn.partialy.pm.ui.widget

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.util.AttributeSet
import android.view.Choreographer
import android.view.View
import androidx.core.content.ContextCompat
import cn.partialy.pm.R
import kotlin.math.PI
import kotlin.math.cos

/**
 * 启动页原生 Canvas 律动音柱：
 * 5 根 4dp 宽圆角蓝条按 250ms 相位差垂直律动，不可见或离屏立即停帧。
 */
class SplashEqualizerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = ContextCompat.getColor(context, R.color.splash_brand_accent)
    }
    private val rect = RectF()
    private val choreographer = Choreographer.getInstance()
    private var frameScheduled = false
    private var startUptimeMs = SystemClock.uptimeMillis()

    private val frameCallback = Choreographer.FrameCallback {
        frameScheduled = false
        if (!canAnimate()) return@FrameCallback
        invalidate()
        scheduleFrame()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val density = resources.displayMetrics.density
        val barWidth = BAR_WIDTH_DP * density
        val barGap = BAR_GAP_DP * density
        val desiredW = (BAR_COUNT * barWidth + (BAR_COUNT - 1) * barGap + paddingLeft + paddingRight).toInt()
        val desiredH = (BAR_MAX_HEIGHT_DP * density + paddingTop + paddingBottom).toInt()
        setMeasuredDimension(
            resolveSize(desiredW, widthMeasureSpec),
            resolveSize(desiredH, heightMeasureSpec),
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val density = resources.displayMetrics.density
        val barWidth = BAR_WIDTH_DP * density
        val barGap = BAR_GAP_DP * density
        val totalWidth = BAR_COUNT * barWidth + (BAR_COUNT - 1) * barGap
        val startX = paddingLeft + ((width - paddingLeft - paddingRight) - totalWidth) / 2f
        val bottomY = (height - paddingBottom).toFloat()
        val maxH = (height - paddingTop - paddingBottom).toFloat().coerceAtLeast(barWidth)
        val radius = barWidth / 2f
        val elapsedMs = if (canAnimate()) {
            (SystemClock.uptimeMillis() - startUptimeMs).coerceAtLeast(0L)
        } else {
            STATIC_PREVIEW_PHASE_MS
        }

        for (i in 0 until BAR_COUNT) {
            val phaseMs = (elapsedMs + i * PHASE_STEP_MS) % CYCLE_DURATION_MS
            val phaseRad = (phaseMs.toDouble() / CYCLE_DURATION_MS.toDouble()) * 2.0 * PI
            val norm = (1.0 - cos(phaseRad)).toFloat() * 0.5f // 0f -> 1f -> 0f
            val scaleY = MIN_SCALE_Y + (1f - MIN_SCALE_Y) * norm
            val h = (maxH * scaleY).coerceAtLeast(barWidth)
            val left = startX + i * (barWidth + barGap)
            rect.set(left, bottomY - h, left + barWidth, bottomY)
            canvas.drawRoundRect(rect, radius, radius, paint)
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        startUptimeMs = SystemClock.uptimeMillis()
        scheduleFrame()
    }

    override fun onDetachedFromWindow() {
        cancelFrame()
        super.onDetachedFromWindow()
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (visibility == VISIBLE) scheduleFrame() else cancelFrame()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        if (visibility == VISIBLE) scheduleFrame() else cancelFrame()
    }

    private fun canAnimate(): Boolean =
        isAttachedToWindow && isShown && windowVisibility == VISIBLE && ValueAnimator.areAnimatorsEnabled()

    private fun scheduleFrame() {
        if (!frameScheduled && canAnimate()) {
            frameScheduled = true
            choreographer.postFrameCallback(frameCallback)
        }
    }

    private fun cancelFrame() {
        if (frameScheduled) {
            choreographer.removeFrameCallback(frameCallback)
            frameScheduled = false
        }
    }

    private companion object {
        const val BAR_COUNT = 5
        const val BAR_WIDTH_DP = 4f
        const val BAR_GAP_DP = 4f
        const val BAR_MAX_HEIGHT_DP = 24f
        const val MIN_SCALE_Y = 0.3f
        const val CYCLE_DURATION_MS = 1600L
        const val PHASE_STEP_MS = 250L
        const val STATIC_PREVIEW_PHASE_MS = 400L
    }
}
