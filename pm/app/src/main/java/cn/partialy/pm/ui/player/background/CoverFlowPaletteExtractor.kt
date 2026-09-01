package cn.partialy.pm.ui.player.background

import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import androidx.core.graphics.drawable.toBitmap
import androidx.palette.graphics.Palette
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal class CoverFlowPaletteExtractor {
    suspend fun extract(drawable: Drawable): CoverFlowPalette = withContext(Dispatchers.Default) {
        val originalBitmap = (drawable as? BitmapDrawable)?.bitmap
        val bitmap = drawable.toBitmap(width = 48, height = 48, config = Bitmap.Config.ARGB_8888)
        try {
            val palette = Palette.from(bitmap).maximumColorCount(8).generate()
            CoverFlowPaletteRules.fromCandidates(
                listOfNotNull(
                    palette.dominantSwatch?.rgb,
                    palette.vibrantSwatch?.rgb,
                    palette.mutedSwatch?.rgb,
                    palette.darkVibrantSwatch?.rgb,
                    palette.lightMutedSwatch?.rgb,
                ),
            )
        } finally {
            if (bitmap !== originalBitmap && !bitmap.isRecycled) {
                bitmap.recycle()
            }
        }
    }
}
