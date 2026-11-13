package cn.partialy.pm.ui.player

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.SweepGradient
import androidx.core.graphics.ColorUtils

/** 盘面材质、圆形封面、透明黑色内圈与中心孔；Shader 只在封面或尺寸改变时重建。 */
internal class CompactDiscRenderer(private val density: Float) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val artworkMatrix = Matrix()
    private var artwork: Bitmap? = null
    private var artworkShader: BitmapShader? = null
    private var surfaceShader: Shader? = null
    private var edgeShader: Shader? = null
    private var centerX = 0f
    private var centerY = 0f
    private var radius = 0f
    private var tint = SILVER

    fun setArtwork(bitmap: Bitmap?) {
        artwork = bitmap
        artworkShader = bitmap?.let { BitmapShader(it, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP) }
        tint = SILVER
        updateShaders()
    }

    fun setSurfaceTint(color: Int?) {
        tint = color ?: SILVER
        updateShaders()
    }

    fun setSize(width: Int, height: Int) {
        centerX = width / 2f
        centerY = height / 2f
        radius = (minOf(centerX, centerY) - density).coerceAtLeast(0f)
        updateShaders()
    }

    private fun updateShaders() {
        if (radius <= 0f) return
        val hsl = FloatArray(3)
        ColorUtils.colorToHSL(tint, hsl)
        // 保留主色相并降低饱和度，深色封面也抬到亮色；黑白封面接近白色盘面。
        val monochrome = hsl[1] < .08f
        hsl[1] = (hsl[1] * .55f).coerceAtMost(.55f)
        hsl[2] = if (monochrome) .94f else .84f + hsl[2] * .08f
        val base = ColorUtils.HSLToColor(hsl)
        val light = ColorUtils.blendARGB(base, Color.WHITE, .60f)
        val shade = ColorUtils.blendARGB(base, SILVER, .18f)
        surfaceShader = SweepGradient(
            centerX, centerY,
            intArrayOf(base, shade, light, base, light, shade, base, light, base),
            floatArrayOf(0f, .12f, .23f, .34f, .47f, .59f, .72f, .86f, 1f),
        )
        edgeShader = RadialGradient(
            centerX, centerY, radius,
            intArrayOf(Color.TRANSPARENT, Color.TRANSPARENT, 0x18FFFFFF, 0x28000000),
            floatArrayOf(0f, .91f, .978f, 1f), Shader.TileMode.CLAMP,
        )
        artwork?.let { bitmap ->
            val diameter = radius * LABEL_RADIUS * 2f
            val scale = diameter / minOf(bitmap.width, bitmap.height)
            artworkMatrix.setScale(scale, scale)
            artworkMatrix.postTranslate(centerX - bitmap.width * scale / 2f, centerY - bitmap.height * scale / 2f)
            artworkShader?.setLocalMatrix(artworkMatrix)
        }
    }

    fun draw(canvas: Canvas, angle: Float) {
        if (radius <= 0f) return
        val checkpoint = canvas.save()
        // 整张 CD 作为一个整体旋转，金属材质与高光和盘内封面保持相同角度。
        canvas.rotate(angle, centerX, centerY)
        paint.style = Paint.Style.FILL
        paint.color = Color.WHITE
        paint.shader = surfaceShader
        canvas.drawCircle(centerX, centerY, radius, paint)
        paint.shader = null

        // 较宽的同心纹和间隔，避免过密的细线在小尺寸下变成噪点。
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = (radius * .0055f).coerceAtLeast(.65f * density)
        for (index in 0..19) {
            paint.color = if (index % 3 == 0) 0x3AFFFFFF else 0x12000000
            canvas.drawCircle(centerX, centerY, radius * (.705f + index * .0144f), paint)
        }
        paint.style = Paint.Style.FILL
        paint.color = Color.WHITE
        paint.shader = edgeShader
        canvas.drawCircle(centerX, centerY, radius, paint)
        paint.shader = null

        paint.shader = artworkShader
        paint.color = tint
        canvas.drawCircle(centerX, centerY, radius * LABEL_RADIUS, paint)
        paint.shader = null
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = density * .8f
        paint.color = 0x60FFFFFF
        canvas.drawCircle(centerX, centerY, radius * LABEL_RADIUS, paint)

        paint.style = Paint.Style.FILL
        paint.color = 0x78000000
        canvas.drawCircle(centerX, centerY, radius * .205f, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = density * .7f
        paint.color = 0x38FFFFFF
        canvas.drawCircle(centerX, centerY, radius * .205f, paint)
        paint.color = 0x55FFFFFF
        canvas.drawCircle(centerX, centerY, radius * .071f, paint)
        paint.style = Paint.Style.FILL
        paint.color = 0xFF111215.toInt()
        canvas.drawCircle(centerX, centerY, radius * CENTER_HOLE_RADIUS, paint)

        paint.style = Paint.Style.STROKE
        paint.strokeWidth = density * .8f
        paint.color = 0x80FFFFFF.toInt()
        canvas.drawCircle(centerX, centerY, radius - paint.strokeWidth / 2f, paint)
        paint.style = Paint.Style.FILL
        canvas.restoreToCount(checkpoint)
    }

    companion object {
        const val CENTER_HOLE_RADIUS = .065f
        private const val LABEL_RADIUS = .68f
        private val SILVER = Color.rgb(208, 210, 216)
    }
}
