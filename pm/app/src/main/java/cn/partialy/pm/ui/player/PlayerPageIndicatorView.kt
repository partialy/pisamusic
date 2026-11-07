package cn.partialy.pm.ui.player

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import cn.partialy.pm.R
import android.graphics.Color

class PlayerPageIndicatorView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    var page: Int = 0
        set(value) { field = value.coerceIn(0, 1); contentDescription = context.getString(if (field == 0) R.string.player_page_cover_description else R.string.player_page_lyrics_description); invalidate() }
    override fun onDraw(canvas: Canvas) {
        val d = resources.displayMetrics.density
        val center = width / 2f
        val y = height / 2f
        for (i in 0..1) {
            paint.color = if (i == page) Color.WHITE else 0x66FFFFFF
            val x = center + (if (i == 0) -10 else 10) * d
            val halfWidth = (if (i == page) 7 else 3) * d
            canvas.drawRoundRect(x - halfWidth, y - 3*d, x + halfWidth, y + 3*d, 3*d, 3*d, paint)
        }
    }
}
