package cn.partialy.pm.ui.widget.colorpicker

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.drawable.Drawable
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * 透明背景棋盘格 Drawable，用于演示含透明度颜色的叠底效果。
 * 支持矩形、圆角矩形或正圆裁剪。
 */
class CheckerboardDrawable(
    cellSizePx: Float,
    lightColor: Int = DEFAULT_LIGHT_COLOR,
    darkColor: Int = DEFAULT_DARK_COLOR,
    private val cornerRadiusPx: Float = 0f,
    private val isCircle: Boolean = false,
) : Drawable() {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val clipPath = Path()
    private val boundsF = RectF()

    init {
        val cell = max(4, cellSizePx.roundToInt())
        val size = cell * 2
        val tile = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(tile)
        val tilePaint = Paint()
        tilePaint.color = lightColor
        c.drawRect(0f, 0f, size.toFloat(), size.toFloat(), tilePaint)
        tilePaint.color = darkColor
        c.drawRect(cell.toFloat(), 0f, size.toFloat(), cell.toFloat(), tilePaint)
        c.drawRect(0f, cell.toFloat(), cell.toFloat(), size.toFloat(), tilePaint)
        paint.shader = BitmapShader(tile, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
    }

    override fun onBoundsChange(bounds: Rect) {
        super.onBoundsChange(bounds)
        boundsF.set(bounds)
        clipPath.reset()
        when {
            isCircle -> {
                val radius = min(boundsF.width(), boundsF.height()) * 0.5f
                clipPath.addCircle(boundsF.centerX(), boundsF.centerY(), radius, Path.Direction.CW)
            }
            cornerRadiusPx > 0f -> {
                clipPath.addRoundRect(boundsF, cornerRadiusPx, cornerRadiusPx, Path.Direction.CW)
            }
        }
    }

    override fun draw(canvas: Canvas) {
        if (bounds.isEmpty) return
        if (isCircle || cornerRadiusPx > 0f) {
            val save = canvas.save()
            canvas.clipPath(clipPath)
            canvas.drawRect(boundsF, paint)
            canvas.restoreToCount(save)
        } else {
            canvas.drawRect(boundsF, paint)
        }
    }

    override fun setAlpha(alpha: Int) {
        paint.alpha = alpha
        invalidateSelf()
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        paint.colorFilter = colorFilter
        invalidateSelf()
    }

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.OPAQUE

    companion object {
        const val DEFAULT_LIGHT_COLOR = 0xFFFFFFFF.toInt()
        const val DEFAULT_DARK_COLOR = 0xFFD9DEE6.toInt()
    }
}
