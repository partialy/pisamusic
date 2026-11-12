package cn.partialy.pm.ui.player

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.SystemClock
import android.util.AttributeSet
import android.view.View
import androidx.core.graphics.drawable.toBitmap

/** 共享封面请求结果；仅播放且封面页可见时旋转，暂停与隐藏保留角度。 */
class CompactDiscView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null,
) : View(context, attrs) {
    private val renderer = CompactDiscRenderer(resources.displayMetrics.density)
    private var playing = false
    private var active = false
    private var angle = 0f
    private var lastFrame = 0L
    private val frame = object : Runnable {
        override fun run() {
            if (!canAnimate()) { lastFrame = 0L; return }
            val now = SystemClock.uptimeMillis()
            if (lastFrame != 0L) angle = (angle + (now - lastFrame) * 360f / 25_000f) % 360f
            lastFrame = now
            invalidate()
            postDelayed(this, 33L)
        }
    }

    fun setArtwork(drawable: Drawable?) {
        // Coil 已禁用硬件位图，可直接共享；占位/失败时恢复中性的银色盘面。
        val bitmap = (drawable as? BitmapDrawable)?.bitmap
            ?: drawable?.toBitmap(512, 512)
        renderer.setArtwork(bitmap)
        invalidate()
    }

    fun setPlayback(playing: Boolean) { this.playing = playing; updateFrames() }
    fun setActive(active: Boolean) { this.active = active; updateFrames() }
    private fun canAnimate() = active && playing && isAttachedToWindow && isShown && ValueAnimator.areAnimatorsEnabled()
    private fun updateFrames() { removeCallbacks(frame); lastFrame = 0L; if (canAnimate()) post(frame) }
    override fun onAttachedToWindow() { super.onAttachedToWindow(); updateFrames() }
    override fun onDetachedFromWindow() { removeCallbacks(frame); lastFrame = 0L; super.onDetachedFromWindow() }
    override fun onVisibilityAggregated(isVisible: Boolean) { super.onVisibilityAggregated(isVisible); updateFrames() }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        renderer.setSize(w, h)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        renderer.draw(canvas, angle)
    }
}
