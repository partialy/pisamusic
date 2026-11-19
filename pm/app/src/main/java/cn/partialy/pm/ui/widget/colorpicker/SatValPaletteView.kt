package cn.partialy.pm.ui.widget.colorpicker

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View

/**
 * 二维饱和度（X: 0..1）与明度（Y: 1..0）取色画布，配合 Hue 与 Alpha 滑条组成完整 HSV 取色器。
 */
class SatValPaletteView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

    var onSvChanged: ((sat: Float, value: Float, fromUser: Boolean) -> Unit)? = null

    private var hue: Float = 0f
    private var saturation: Float = 1f
    private var value: Float = 1f

    private val density = resources.displayMetrics.density
    private val cornerRadiusPx = 12f * density
    private val thumbRadiusPx = 9f * density
    private val insetPx = thumbRadiusPx + 2f * density

    private val paletteRect = RectF()
    private val clipPath = Path()

    private val satPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val valPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1f * density
        color = 0x26000000
    }
    private val thumbFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }
    private val thumbWhiteStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2.5f * density
        color = Color.WHITE
    }
    private val thumbOuterStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1f * density
        color = 0x55000000
    }

    private val hsvScratch = FloatArray(3)
    private var shadersDirty = true

    fun setHue(hueDegrees: Float) {
        val normalized = ((hueDegrees % 360f) + 360f) % 360f
        if (normalized == hue) return
        hue = normalized
        shadersDirty = true
        invalidate()
    }

    fun setSatVal(sat: Float, valBrightness: Float) {
        val clampedSat = sat.coerceIn(0f, 1f)
        val clampedVal = valBrightness.coerceIn(0f, 1f)
        if (clampedSat == saturation && clampedVal == value) return
        saturation = clampedSat
        value = clampedVal
        invalidate()
    }

    fun setHsv(hueDegrees: Float, sat: Float, valBrightness: Float) {
        val normalized = ((hueDegrees % 360f) + 360f) % 360f
        val clampedSat = sat.coerceIn(0f, 1f)
        val clampedVal = valBrightness.coerceIn(0f, 1f)
        if (normalized != hue) {
            hue = normalized
            shadersDirty = true
        }
        saturation = clampedSat
        value = clampedVal
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        val left = paddingLeft + insetPx
        val top = paddingTop + insetPx
        val right = (w - paddingRight - insetPx).coerceAtLeast(left + 1f)
        val bottom = (h - paddingBottom - insetPx).coerceAtLeast(top + 1f)
        paletteRect.set(left, top, right, bottom)
        clipPath.reset()
        clipPath.addRoundRect(paletteRect, cornerRadiusPx, cornerRadiusPx, Path.Direction.CW)
        shadersDirty = true
    }

    private fun ensureShaders() {
        if (!shadersDirty || paletteRect.isEmpty) return
        hsvScratch[0] = hue
        hsvScratch[1] = 1f
        hsvScratch[2] = 1f
        val hueColor = Color.HSVToColor(hsvScratch)
        satPaint.shader = LinearGradient(
            paletteRect.left,
            paletteRect.top,
            paletteRect.right,
            paletteRect.top,
            Color.WHITE,
            hueColor,
            Shader.TileMode.CLAMP,
        )
        valPaint.shader = LinearGradient(
            paletteRect.left,
            paletteRect.top,
            paletteRect.left,
            paletteRect.bottom,
            Color.TRANSPARENT,
            Color.BLACK,
            Shader.TileMode.CLAMP,
        )
        shadersDirty = false
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (paletteRect.isEmpty) return
        ensureShaders()

        val save = canvas.save()
        canvas.clipPath(clipPath)
        canvas.drawRect(paletteRect, satPaint)
        canvas.drawRect(paletteRect, valPaint)
        canvas.restoreToCount(save)

        canvas.drawRoundRect(paletteRect, cornerRadiusPx, cornerRadiusPx, borderPaint)

        val cx = paletteRect.left + saturation * paletteRect.width()
        val cy = paletteRect.top + (1f - value) * paletteRect.height()
        hsvScratch[0] = hue
        hsvScratch[1] = saturation
        hsvScratch[2] = value
        thumbFillPaint.color = Color.HSVToColor(hsvScratch)
        canvas.drawCircle(cx, cy, thumbRadiusPx, thumbFillPaint)
        canvas.drawCircle(cx, cy, thumbRadiusPx, thumbWhiteStrokePaint)
        canvas.drawCircle(cx, cy, thumbRadiusPx + 1.25f * density, thumbOuterStrokePaint)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!isEnabled || paletteRect.isEmpty) return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                updateFromTouch(event.x, event.y)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                updateFromTouch(event.x, event.y)
                return true
            }
            MotionEvent.ACTION_UP -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                updateFromTouch(event.x, event.y)
                performClick()
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun performClick(): Boolean {
        return super.performClick()
    }

    private fun updateFromTouch(x: Float, y: Float) {
        val newSat = ((x - paletteRect.left) / paletteRect.width()).coerceIn(0f, 1f)
        val newVal = (1f - (y - paletteRect.top) / paletteRect.height()).coerceIn(0f, 1f)
        if (newSat != saturation || newVal != value) {
            saturation = newSat
            value = newVal
            invalidate()
            onSvChanged?.invoke(saturation, value, true)
        }
    }
}
