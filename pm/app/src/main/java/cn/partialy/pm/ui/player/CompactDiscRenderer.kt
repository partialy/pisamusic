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
        tint = bitmap?.let(::sampleTint) ?: SILVER
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
        val base = ColorUtils.blendARGB(tint, SILVER, .66f)
        val light = ColorUtils.blendARGB(base, Color.WHITE, .74f)
        val shade = ColorUtils.blendARGB(base, Color.BLACK, .22f)
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
        paint.style = Paint.Style.FILL
        paint.color = Color.WHITE
        paint.shader = surfaceShader
        canvas.drawCircle(centerX, centerY, radius, paint)
        paint.shader = null

        // 密而浅的同心纹模拟 CD 数据层，保留取色后的金属反光。
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = (.35f * density).coerceAtLeast(.5f)
        for (index in 0..64) {
            paint.color = if (index % 3 == 0) 0x24FFFFFF else 0x10000000
            canvas.drawCircle(centerX, centerY, radius * (.70f + index * .0044f), paint)
        }
        paint.style = Paint.Style.FILL
        paint.color = Color.WHITE
        paint.shader = edgeShader
        canvas.drawCircle(centerX, centerY, radius, paint)
        paint.shader = null

        // 封面随盘旋转，高光保持在光源方向，避免整块材质像贴纸一样转动。
        val checkpoint = canvas.save()
        canvas.rotate(angle, centerX, centerY)
        paint.shader = artworkShader
        paint.color = tint
        canvas.drawCircle(centerX, centerY, radius * LABEL_RADIUS, paint)
        paint.shader = null
        canvas.restoreToCount(checkpoint)
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
        canvas.drawCircle(centerX, centerY, radius * .065f, paint)

        paint.style = Paint.Style.STROKE
        paint.strokeWidth = density * .8f
        paint.color = 0x80FFFFFF.toInt()
        canvas.drawCircle(centerX, centerY, radius - paint.strokeWidth / 2f, paint)
        paint.style = Paint.Style.FILL
    }

    private fun sampleTint(bitmap: Bitmap): Int {
        var red = 0L
        var green = 0L
        var blue = 0L
        var weight = 0L
        // 固定 8×8 采样，不逐帧量化，也不重新下载或复制高清封面。
        for (y in 0 until 8) for (x in 0 until 8) {
            val color = bitmap.getPixel((bitmap.width * (x * 2 + 1) / 16).coerceAtMost(bitmap.width - 1),
                (bitmap.height * (y * 2 + 1) / 16).coerceAtMost(bitmap.height - 1))
            val alpha = Color.alpha(color)
            red += Color.red(color) * alpha
            green += Color.green(color) * alpha
            blue += Color.blue(color) * alpha
            weight += alpha
        }
        return if (weight == 0L) SILVER else Color.rgb((red / weight).toInt(), (green / weight).toInt(), (blue / weight).toInt())
    }

    private companion object {
        const val LABEL_RADIUS = .68f
        val SILVER = Color.rgb(208, 210, 216)
    }
}
