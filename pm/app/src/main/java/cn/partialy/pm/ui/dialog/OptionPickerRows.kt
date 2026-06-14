package cn.partialy.pm.ui.dialog

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.graphics.ColorUtils
import androidx.core.widget.ImageViewCompat
import cn.partialy.pm.R
import com.google.android.material.card.MaterialCardView
import com.google.android.material.color.MaterialColors

internal class OptionPickerRows private constructor(
    private val rows: List<Row>,
    private val selectedBackgroundColor: Int,
    private val selectedTextColor: Int,
    private val normalTextColor: Int,
    selectedIndex: Int,
) {
    var selectedIndex: Int = selectedIndex
        private set

    fun select(index: Int) {
        selectedIndex = index.coerceIn(rows.indices)
        rows.forEachIndexed { rowIndex, row ->
            val selected = rowIndex == selectedIndex
            row.card.setCardBackgroundColor(
                if (selected) selectedBackgroundColor else Color.TRANSPARENT,
            )
            row.label.setTextColor(if (selected) selectedTextColor else normalTextColor)
            row.check.visibility = if (selected) View.VISIBLE else View.GONE
        }
    }

    private data class Row(
        val card: MaterialCardView,
        val label: TextView,
        val check: ImageView,
    )

    companion object {
        fun bind(
            context: Context,
            container: LinearLayout,
            labels: List<CharSequence>,
            selectedIndex: Int,
        ): OptionPickerRows {
            val primaryColor = MaterialColors.getColor(
                container,
                com.google.android.material.R.attr.colorPrimary,
                Color.BLUE,
            )
            val normalTextColor = MaterialColors.getColor(
                container,
                com.google.android.material.R.attr.colorOnSurface,
                Color.BLACK,
            )
            val rows = labels.map { text ->
                val card = LayoutInflater.from(context).inflate(
                    R.layout.item_settings_option_sheet_row,
                    container,
                    false,
                ) as MaterialCardView
                val label = card.findViewById<TextView>(R.id.optionLabel)
                val check = card.findViewById<ImageView>(R.id.optionCheck)
                label.text = text
                ImageViewCompat.setImageTintList(check, ColorStateList.valueOf(primaryColor))
                card.layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                container.addView(card)
                Row(card, label, check)
            }
            val selection = OptionPickerRows(
                rows = rows,
                selectedBackgroundColor = ColorUtils.setAlphaComponent(primaryColor, 24),
                selectedTextColor = primaryColor,
                normalTextColor = normalTextColor,
                selectedIndex = selectedIndex.coerceIn(labels.indices),
            )
            rows.forEachIndexed { index, row ->
                row.card.setOnClickListener { selection.select(index) }
            }
            selection.select(selection.selectedIndex)
            return selection
        }
    }
}
