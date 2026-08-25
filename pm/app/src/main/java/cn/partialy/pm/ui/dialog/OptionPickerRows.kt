package cn.partialy.pm.ui.dialog

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.graphics.ColorUtils
import androidx.core.widget.ImageViewCompat
import cn.partialy.pm.R
import cn.partialy.pm.model.DownloadQualityOption
import com.google.android.material.card.MaterialCardView
import com.google.android.material.color.MaterialColors

internal class OptionPickerRows private constructor(
    private val rows: List<Row>,
    private val selectedBackgroundColor: Int,
    private val selectedTextColor: Int,
    private val normalTextColor: Int,
    private val summaryTextColor: Int,
    private val disabledTextColor: Int,
    selectedIndex: Int,
) {
    var selectedIndex: Int = selectedIndex
        private set

    fun select(index: Int) {
        if (index !in rows.indices || !rows[index].enabled) return
        selectedIndex = index
        rows.forEachIndexed { rowIndex, row ->
            val selected = row.enabled && rowIndex == selectedIndex
            row.card.setCardBackgroundColor(
                if (selected) selectedBackgroundColor else Color.TRANSPARENT,
            )
            row.label.setTextColor(
                when {
                    !row.enabled -> disabledTextColor
                    selected -> selectedTextColor
                    else -> normalTextColor
                },
            )
            row.summary.setTextColor(if (row.enabled) summaryTextColor else disabledTextColor)
            ImageViewCompat.setImageTintList(
                row.check,
                ColorStateList.valueOf(if (row.enabled) selectedTextColor else disabledTextColor),
            )
            row.label.alpha = if (row.enabled) ENABLED_ALPHA else DISABLED_ALPHA
            row.summary.alpha = if (row.enabled) ENABLED_ALPHA else DISABLED_ALPHA
            row.check.alpha = if (row.enabled) ENABLED_ALPHA else DISABLED_ALPHA
            row.check.visibility = if (selected) View.VISIBLE else View.GONE
        }
    }

    private data class Row(
        val card: MaterialCardView,
        val label: TextView,
        val summary: TextView,
        val check: ImageView,
        val enabled: Boolean,
    )

    private data class PickerOption(
        val label: String,
        val summary: String? = null,
        val enabled: Boolean = true,
        val badge: String? = null,
    )

    companion object {
        private const val ENABLED_ALPHA = 1f
        private const val DISABLED_ALPHA = 0.38f

        fun bind(
            context: Context,
            container: LinearLayout,
            labels: List<CharSequence>,
            selectedIndex: Int,
        ): OptionPickerRows = bindOptions(
            context = context,
            container = container,
            options = labels.mapIndexed { index, label ->
                SettingsOption(id = index.toString(), label = label.toString())
            },
            selectedIndex = selectedIndex,
        )

        fun bindQualityOptions(
            context: Context,
            container: LinearLayout,
            options: List<DownloadQualityOption>,
            selectedIndex: Int,
            onDisabledOptionClick: ((DownloadQualityOption) -> Unit)? = null,
        ): OptionPickerRows = bindRows(
            context = context,
            container = container,
            options = options.map { option ->
                PickerOption(
                    label = option.label,
                    enabled = option.enabled,
                    badge = option.badge,
                )
            },
            selectedIndex = selectedIndex,
            onDisabledOptionClick = onDisabledOptionClick?.let { callback ->
                { index -> callback(options[index]) }
            },
        )

        fun bindOptions(
            context: Context,
            container: LinearLayout,
            options: List<SettingsOption>,
            selectedIndex: Int,
        ): OptionPickerRows = bindRows(
            context = context,
            container = container,
            options = options.map { option ->
                PickerOption(
                    label = option.label,
                    summary = option.summary,
                    enabled = option.enabled,
                    badge = option.badge,
                )
            },
            selectedIndex = selectedIndex,
        )

        private fun bindRows(
            context: Context,
            container: LinearLayout,
            options: List<PickerOption>,
            selectedIndex: Int,
            onDisabledOptionClick: ((Int) -> Unit)? = null,
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
            val summaryTextColor = MaterialColors.getColor(
                container,
                com.google.android.material.R.attr.colorOnSurfaceVariant,
                normalTextColor,
            )
            val disabledTextColor = summaryTextColor
            val rows = options.map { option ->
                val card = LayoutInflater.from(context).inflate(
                    R.layout.item_settings_option_sheet_row,
                    container,
                    false,
                ) as MaterialCardView
                val label = card.findViewById<TextView>(R.id.optionLabel)
                val summary = card.findViewById<TextView>(R.id.optionSummary)
                val badge = card.findViewById<TextView>(R.id.optionBadge)
                val check = card.findViewById<ImageView>(R.id.optionCheck)
                label.text = option.label
                summary.text = option.summary.orEmpty()
                summary.visibility = if (option.summary.isNullOrEmpty()) View.GONE else View.VISIBLE
                badge.text = option.badge.orEmpty()
                badge.visibility = if (option.badge.isNullOrEmpty()) View.GONE else View.VISIBLE
                badge.setTextColor(primaryColor)
                badge.background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = 12f * context.resources.displayMetrics.density
                    setColor(ColorUtils.setAlphaComponent(primaryColor, 24))
                }
                ImageViewCompat.setImageTintList(check, ColorStateList.valueOf(primaryColor))
                val handlesClick = option.enabled || onDisabledOptionClick != null
                card.isClickable = handlesClick
                card.isFocusable = handlesClick
                if (!handlesClick) card.foreground = null
                card.layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                container.addView(card)
                Row(card, label, summary, check, option.enabled)
            }
            val fallbackIndex = rows.indexOfFirst { it.enabled }
            val initialIndex = selectedIndex
                .takeIf { it in rows.indices && rows[it].enabled }
                ?: fallbackIndex
            val selection = OptionPickerRows(
                rows = rows,
                selectedBackgroundColor = ColorUtils.setAlphaComponent(primaryColor, 24),
                selectedTextColor = primaryColor,
                normalTextColor = normalTextColor,
                summaryTextColor = summaryTextColor,
                disabledTextColor = disabledTextColor,
                selectedIndex = initialIndex,
            )
            rows.forEachIndexed { index, row ->
                if (row.enabled) {
                    row.card.setOnClickListener { selection.select(index) }
                } else if (onDisabledOptionClick != null) {
                    row.card.setOnClickListener { onDisabledOptionClick(index) }
                }
            }
            if (selection.selectedIndex >= 0) selection.select(selection.selectedIndex)
            return selection
        }
    }
}
