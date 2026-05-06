package cn.partialy.pm.ui.player

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.utils.LyricDisplayPrefs

data class LyricRow(
    val timeMs: Long,
    val text: String,
)

class LyricsAdapter : ListAdapter<LyricRow, LyricsAdapter.VH>(Diff()) {

    private var currentIndex: Int = -1
    private var displayStyle: LyricDisplayStyle = LyricDisplayStyle.DEFAULT

    fun applyStyleFromPrefs(context: Context) {
        displayStyle = LyricDisplayPrefs.readStyle(context)
        notifyDataSetChanged()
    }

    fun setDisplayStyle(style: LyricDisplayStyle) {
        displayStyle = style
        notifyDataSetChanged()
    }

    fun setCurrentIndex(index: Int) {
        if (index == currentIndex) return
        val old = currentIndex
        currentIndex = index
        if (old >= 0) notifyItemChanged(old, PAYLOAD_HIGHLIGHT)
        if (currentIndex >= 0) notifyItemChanged(currentIndex, PAYLOAD_HIGHLIGHT)
    }

    fun adjustTextSize(deltaSp: Float, context: Context) {
        LyricDisplayPrefs.addTextSizeSp(context, deltaSp)
        applyStyleFromPrefs(context)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_lyric_line, parent, false) as TextView
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(getItem(position), position == currentIndex, displayStyle)
    }

    override fun onBindViewHolder(holder: VH, position: Int, payloads: MutableList<Any>) {
        if (payloads.contains(PAYLOAD_HIGHLIGHT)) {
            holder.applyHighlight(position == currentIndex, displayStyle)
            return
        }
        super.onBindViewHolder(holder, position, payloads)
    }

    class VH(private val tv: TextView) : RecyclerView.ViewHolder(tv) {
        fun bind(row: LyricRow, highlighted: Boolean, style: LyricDisplayStyle) {
            tv.text = row.text
            applyHighlight(highlighted, style)
        }

        fun applyHighlight(highlighted: Boolean, style: LyricDisplayStyle) {
            tv.textSize = when {
                highlighted && style.currentLineEnlarged -> style.textSizeSp + style.currentLineEnlargedDxSp
                else -> style.textSizeSp
            }
            when (style.alignment) {
                LyricAlignment.START -> {
                    tv.textAlignment = View.TEXT_ALIGNMENT_VIEW_START
                    tv.gravity = Gravity.START or Gravity.CENTER_VERTICAL
                }
                LyricAlignment.CENTER -> {
                    tv.textAlignment = View.TEXT_ALIGNMENT_CENTER
                    tv.gravity = Gravity.CENTER_HORIZONTAL or Gravity.CENTER_VERTICAL
                }
                LyricAlignment.END -> {
                    tv.textAlignment = View.TEXT_ALIGNMENT_VIEW_END
                    tv.gravity = Gravity.END or Gravity.CENTER_VERTICAL
                }
            }
            when {
                highlighted && style.currentLineBold -> tv.setTypeface(Typeface.DEFAULT, Typeface.BOLD)
                highlighted -> tv.typeface = Typeface.DEFAULT
                else -> tv.typeface = Typeface.DEFAULT
            }
            tv.setTextColor(
                if (highlighted) style.currentColorArgb else style.resolvedNormalColor(),
            )
        }
    }

    private class Diff : DiffUtil.ItemCallback<LyricRow>() {
        override fun areItemsTheSame(oldItem: LyricRow, newItem: LyricRow): Boolean =
            oldItem.timeMs == newItem.timeMs && oldItem.text == newItem.text

        override fun areContentsTheSame(oldItem: LyricRow, newItem: LyricRow): Boolean = oldItem == newItem
    }

    private companion object {
        private val PAYLOAD_HIGHLIGHT = Any()
    }
}
