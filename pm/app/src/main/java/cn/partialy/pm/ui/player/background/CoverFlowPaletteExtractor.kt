package cn.partialy.pm.ui.player.background

import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import androidx.palette.graphics.Palette
import androidx.core.graphics.drawable.toBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal class CoverFlowPaletteExtractor {
    suspend fun extract(drawable: Drawable): CoverFlowPalette = withContext(Dispatchers.Default) {
        val originalBitmap = (drawable as? BitmapDrawable)?.bitmap
        val bitmap = drawable.toBitmap(width = 48, height = 48, config = Bitmap.Config.ARGB_8888)
        try {
            val pixels = IntArray(bitmap.width * bitmap.height)
            bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
            val visible = pixels.filter { it ushr 24 >= 128 }
            if (visible.isEmpty()) return@withContext CoverFlowPaletteRules.fromCandidates(emptyList())
            // 先排除透明像素，避免量化丢失 alpha 后把透明黑色作为主色。
            val visibleBitmap = Bitmap.createBitmap(visible.toIntArray(), visible.size, 1, Bitmap.Config.ARGB_8888)
            try {
                val palette = Palette.from(visibleBitmap).maximumColorCount(8).generate()
                CoverFlowPaletteRules.fromCandidates(palette.swatches.sortedByDescending { it.population }.map { it.rgb })
            } finally { visibleBitmap.recycle() }
        } finally {
            if (bitmap !== originalBitmap && !bitmap.isRecycled) {
                bitmap.recycle()
            }
        }
    }
}
