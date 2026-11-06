package cn.partialy.pm.ui.player

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.SystemClock
import android.util.AttributeSet
import android.view.View

/** 黑胶只有一个低频帧回调；暂停、隐藏与离开播放器均保留角度并停止调度。 */
class VinylDiscView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
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

    fun setPlayback(playing: Boolean) { this.playing = playing; updateFrames() }
    fun setActive(active: Boolean) { this.active = active; updateFrames() }
    private fun canAnimate() = active && playing && isAttachedToWindow && isShown && ValueAnimator.areAnimatorsEnabled()
    private fun updateFrames() { removeCallbacks(frame); lastFrame = 0L; if (canAnimate()) post(frame) }
    override fun onAttachedToWindow() { super.onAttachedToWindow(); updateFrames() }
    override fun onDetachedFromWindow() { removeCallbacks(frame); lastFrame = 0L; super.onDetachedFromWindow() }
    override fun onVisibilityAggregated(isVisible: Boolean) { super.onVisibilityAggregated(isVisible); updateFrames() }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val cx = width / 2f
        val cy = height / 2f
        val radius = minOf(cx, cy)
        canvas.save()
        canvas.rotate(angle, cx, cy)
        paint.style = Paint.Style.FILL
        paint.color = Color.rgb(18, 19, 23)
        canvas.drawCircle(cx, cy, radius, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = resources.displayMetrics.density * .65f
        for (i in 16..48) {
            paint.color = if (i % 3 == 0) 0xFF33343A.toInt() else 0xFF25262C.toInt()
            canvas.drawCircle(cx, cy, radius * i / 50f, paint)
        }
        paint.color = 0x553F414B
        paint.strokeWidth = radius * .11f
        canvas.drawArc(cx - radius * .72f, cy - radius * .72f, cx + radius * .72f, cy + radius * .72f, 15f, 65f, false, paint)
        paint.style = Paint.Style.FILL
        paint.color = 0xFF505361.toInt()
        canvas.drawCircle(cx, cy, radius * .29f, paint)
        paint.color = 0xFF17181D.toInt()
        canvas.drawCircle(cx, cy, radius * .055f, paint)
        canvas.restore()
    }
}
