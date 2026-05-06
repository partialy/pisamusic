package cn.partialy.pm.ui.widget

import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.View
import android.widget.TextView
import androidx.core.content.ContextCompat
import cn.partialy.pm.R
import cn.partialy.pm.model.SongType

/**
 * Element UI `el-tag` 风格：细边框 + 浅色底 + 同色字，用于歌曲来源 KG / KW / WY / LOCAL。
 */
object SongSourceTagBinder {

    enum class Surface {
        /** 列表、Sheet 等普通表面 */
        LIST,
        /** 播放页顶栏等深色背景 */
        ON_DARK,
    }

    fun bind(tagView: TextView, type: SongType, surface: Surface = Surface.LIST) {
        val ctx = tagView.context
        val (border, fill, text) = colors(ctx, type, surface)
        tagView.visibility = View.VISIBLE
        tagView.text = label(type)
        tagView.setTextColor(text)
        tagView.includeFontPadding = false
        val strokePx = dp(ctx, 0.5f).toInt().coerceAtLeast(1)
        val radiusPx = dp(ctx, 1.5f)
        val padH = dp(ctx, 3f).toInt()
        val padV = dp(ctx, 0.5f).toInt().coerceAtLeast(1)
        tagView.setPadding(padH, padV, padH, padV)
        tagView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 9f)
        tagView.background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radiusPx
            setStroke(strokePx, border)
            setColor(fill)
        }
    }

    fun hide(tagView: TextView) {
        tagView.visibility = View.GONE
    }

    private fun label(type: SongType): String = when (type) {
        SongType.KG -> "KG"
        SongType.KW -> "KW"
        SongType.WY -> "WY"
        SongType.LOCAL -> "LOCAL"
    }

    private fun colors(ctx: android.content.Context, type: SongType, surface: Surface): Triple<Int, Int, Int> {
        return when (surface) {
            Surface.LIST -> when (type) {
                SongType.KG -> triple(ctx, R.color.song_tag_kg_border, R.color.song_tag_kg_fill, R.color.song_tag_kg_text)
                SongType.KW -> triple(ctx, R.color.song_tag_kw_border, R.color.song_tag_kw_fill, R.color.song_tag_kw_text)
                SongType.WY -> triple(ctx, R.color.song_tag_wy_border, R.color.song_tag_wy_fill, R.color.song_tag_wy_text)
                SongType.LOCAL -> triple(ctx, R.color.song_tag_local_border, R.color.song_tag_local_fill, R.color.song_tag_local_text)
            }
            Surface.ON_DARK -> when (type) {
                SongType.KG -> triple(ctx, R.color.song_tag_kg_border_dark, R.color.song_tag_kg_fill_dark, R.color.song_tag_kg_text_dark)
                SongType.KW -> triple(ctx, R.color.song_tag_kw_border_dark, R.color.song_tag_kw_fill_dark, R.color.song_tag_kw_text_dark)
                SongType.WY -> triple(ctx, R.color.song_tag_wy_border_dark, R.color.song_tag_wy_fill_dark, R.color.song_tag_wy_text_dark)
                SongType.LOCAL -> triple(ctx, R.color.song_tag_local_border_dark, R.color.song_tag_local_fill_dark, R.color.song_tag_local_text_dark)
            }
        }
    }

    private fun triple(ctx: android.content.Context, border: Int, fill: Int, text: Int): Triple<Int, Int, Int> =
        Triple(
            ContextCompat.getColor(ctx, border),
            ContextCompat.getColor(ctx, fill),
            ContextCompat.getColor(ctx, text),
        )

    private fun dp(ctx: android.content.Context, v: Float): Float =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, ctx.resources.displayMetrics)
}
