package cn.partialy.pm.ui.player.background

import android.animation.ValueAnimator
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.ContentObserver
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat

/** 单一不透明画布；每个光场外缘透明，不再移动有矩形边界的子 View。 */
internal class FlowingCoverBackgroundView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val matrix = Matrix()
    private val position = FloatArray(3)
    private val shaders = Array(4) {
        RadialGradient(0f, 0f, 1f, intArrayOf(Color.WHITE, 0xA0FFFFFF.toInt(), Color.TRANSPARENT), floatArrayOf(0f, 0.35f, 1f), Shader.TileMode.CLAMP)
    }
    private val filterColors = IntArray(4)
    private val filters = arrayOfNulls<android.graphics.PorterDuffColorFilter>(4)
    private var source = CoverFlowPaletteRules.fromCandidates(emptyList())
    private var from = source
    private var target = source
    private val displayed = IntArray(5)
    private var transitionStart = 0L
    private var transitioning = false
    private var specs = FlowingCoverMotionRules.specs(0L)
    private var seeded = false
    private var config = PlayerFlowBackgroundConfig()
    private var preview = false
    private var requested = false
    private var released = false
    private var lastTick = 0L
    private var phaseSeconds = 0.0
    private var attached = false
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private val tick = object : Runnable {
        override fun run() {
            if (!eligible()) return
            val now = SystemClock.uptimeMillis()
            if (lastTick != 0L) phaseSeconds += (now - lastTick).coerceAtMost(150L) / 1000.0 * config.speedMultiplier
            lastTick = now
            invalidate()
            postDelayed(this, FlowingCoverMotionRules.frameIntervalMs(preview, powerManager.isPowerSaveMode))
        }
    }
    private val settingsObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean) = refreshScheduling()
    }
    private val powerReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = refreshScheduling()
    }

    fun setPreviewMode(enabled: Boolean) { preview = enabled; refreshScheduling() }
    fun setConfig(value: PlayerFlowBackgroundConfig) {
        config = value.normalized()
        updatePalette(source, animateTransition = true)
    }
    fun submitPalette(palette: CoverFlowPalette, seed: Long, animateTransition: Boolean) {
        if (released) return
        if (!seeded) { specs = FlowingCoverMotionRules.specs(seed); seeded = true }
        updatePalette(palette, animateTransition)
    }
    private fun updatePalette(palette: CoverFlowPalette, animateTransition: Boolean) {
        if (released) return
        updateColors(SystemClock.uptimeMillis())
        from = CoverFlowPalette(displayed[0], displayed.drop(1))
        source = palette
        target = CoverFlowPaletteRules.applyConfig(palette, config)
        transitioning = animateTransition && ValueAnimator.areAnimatorsEnabled() && requested
        transitionStart = SystemClock.uptimeMillis()
        if (!transitioning) from = target
        invalidate()
    }
    fun startMotion() { if (!released) { requested = true; refreshScheduling() } }
    fun stopMotion() { requested = false; refreshScheduling() }
    fun release() { stopMotion(); released = true; unregisterObservers() }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        attached = true
        context.contentResolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, settingsObserver)
        ContextCompat.registerReceiver(context, powerReceiver, IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED)
        refreshScheduling()
    }
    override fun onDetachedFromWindow() { unregisterObservers(); refreshScheduling(); super.onDetachedFromWindow() }
    private fun unregisterObservers() {
        if (!attached) return
        attached = false
        context.contentResolver.unregisterContentObserver(settingsObserver)
        context.unregisterReceiver(powerReceiver)
    }
    override fun onVisibilityChanged(changedView: View, visibility: Int) { super.onVisibilityChanged(changedView, visibility); if (attached) refreshScheduling() }
    override fun onWindowVisibilityChanged(visibility: Int) { super.onWindowVisibilityChanged(visibility); if (attached) refreshScheduling() }
    private fun eligible() = attached && requested && !released && isShown && windowVisibility == VISIBLE && ValueAnimator.areAnimatorsEnabled()
    private fun refreshScheduling() {
        removeCallbacks(tick)
        lastTick = 0L
        if (eligible()) post(tick)
        if (!ValueAnimator.areAnimatorsEnabled()) { transitioning = false; from = target }
        invalidate()
    }
    private fun updateColors(now: Long) {
        val progress = if (transitioning) ((now - transitionStart) / 1250f).coerceIn(0f, 1f) else 1f
        val eased = progress * progress * (3f - 2f * progress)
        displayed[0] = CoverFlowPaletteRules.interpolateColor(from.baseColor, target.baseColor, eased)
        for (index in 0..3) displayed[index + 1] = CoverFlowPaletteRules.interpolateColor(from.blobColors[index], target.blobColors[index], eased)
        if (progress >= 1f) transitioning = false
    }
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        updateColors(SystemClock.uptimeMillis())
        canvas.drawColor(displayed[0])
        val extent = maxOf(width, height).toFloat()
        for (index in 0..3) {
            FlowingCoverMotionRules.positionInto(specs[index], index, phaseSeconds, config.motionAmplitudePercent / 50f, position)
            val radius = extent * position[2]
            matrix.setScale(radius, radius * 1.12f)
            matrix.postTranslate(position[0] * width, position[1] * height)
            shaders[index].setLocalMatrix(matrix)
            paint.shader = shaders[index]
            if (filters[index] == null || filterColors[index] != displayed[index + 1]) {
                filterColors[index] = displayed[index + 1]
                filters[index] = android.graphics.PorterDuffColorFilter(displayed[index + 1], android.graphics.PorterDuff.Mode.MULTIPLY)
            }
            paint.colorFilter = filters[index]
            paint.alpha = (55 + config.glowIntensityPercent * 0.95f).toInt()
            canvas.drawPaint(paint)
        }
        paint.shader = null
        paint.colorFilter = null
        // 圆滑的统一暗化与深色底色共同约束极端亮封面，避免局部矩形遮罩。
        paint.color = Color.BLACK
        paint.alpha = CoverFlowPaletteRules.scrimAlpha(target)
        canvas.drawPaint(paint)
    }
}
