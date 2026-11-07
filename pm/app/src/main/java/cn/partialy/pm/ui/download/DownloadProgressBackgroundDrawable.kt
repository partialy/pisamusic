package cn.partialy.pm.ui.download

import android.animation.ValueAnimator
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Shader
import android.graphics.drawable.Drawable
import android.os.SystemClock
import androidx.core.graphics.ColorUtils

/** 整行低强度进度填充；帧由 Drawable callback 调度，离屏不占用动画。 */
class DownloadProgressBackgroundDrawable(private val color: Int) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var progress = 0f
    private var indeterminate = false
    private var downloading = false
    private var active = false
    private var scheduled = false
    private var phase = 0f
    private var drawableAlpha = 255
    private val frame = object : Runnable {
        override fun run() {
            scheduled = false
            if (!shouldAnimate()) { invalidateSelf(); return }
            phase = (SystemClock.uptimeMillis() % 1800L) / 1800f
            invalidateSelf()
            scheduleFrame()
        }
    }

    fun update(progressPercent: Int, unknownLength: Boolean, downloading: Boolean, showProgress: Boolean) {
        progress = if (showProgress) progressPercent.coerceIn(0, 100) / 100f else 0f
        indeterminate = unknownLength && showProgress
        this.downloading = downloading
        synchronize()
        invalidateSelf()
    }

    fun setActive(value: Boolean) {
        active = value
        synchronize()
    }

    private fun shouldAnimate() = active && isVisible && downloading && ValueAnimator.areAnimatorsEnabled()
    private fun synchronize() {
        if (shouldAnimate()) scheduleFrame() else {
            unscheduleSelf(frame)
            scheduled = false
        }
    }
    private fun scheduleFrame() {
        if (!scheduled) {
            scheduled = true
            scheduleSelf(frame, SystemClock.uptimeMillis() + 34L)
        }
    }
    override fun setVisible(visible: Boolean, restart: Boolean): Boolean {
        val changed = super.setVisible(visible, restart)
        synchronize()
        return changed
    }
    override fun draw(canvas: Canvas) {
        if (bounds.isEmpty) return
        val width = bounds.width().toFloat()
        val fillWidth = if (indeterminate) width else width * progress
        if (fillWidth <= 0f) return
        val save = canvas.save()
        canvas.clipRect(bounds.left.toFloat(), bounds.top.toFloat(), bounds.left + fillWidth, bounds.bottom.toFloat())
        paint.shader = null
        paint.color = ColorUtils.setAlphaComponent(color, (if (indeterminate) 9 else 22) * drawableAlpha / 255)
        canvas.drawRect(bounds, paint)
        if (shouldAnimate()) {
            val center = bounds.left + (phase * 1.6f - 0.3f) * fillWidth
            val half = (fillWidth * 0.25f).coerceAtLeast(24f)
            paint.shader = LinearGradient(center - half, 0f, center + half, 0f,
                intArrayOf(ColorUtils.setAlphaComponent(color, 0), ColorUtils.setAlphaComponent(color, 24 * drawableAlpha / 255), ColorUtils.setAlphaComponent(color, 0)), null, Shader.TileMode.CLAMP)
            canvas.drawRect(bounds, paint)
            paint.shader = null
        }
        canvas.restoreToCount(save)
    }
    override fun setAlpha(alpha: Int) { drawableAlpha = alpha; invalidateSelf() }
    override fun setColorFilter(colorFilter: ColorFilter?) { paint.colorFilter = colorFilter; invalidateSelf() }
    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}
