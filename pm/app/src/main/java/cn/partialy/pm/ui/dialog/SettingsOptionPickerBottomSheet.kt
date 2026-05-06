package cn.partialy.pm.ui.dialog

import android.content.Context
import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import cn.partialy.pm.R
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.card.MaterialCardView
import com.google.android.material.color.MaterialColors
import kotlin.coroutines.resume
import kotlin.math.roundToInt
import kotlinx.coroutines.suspendCancellableCoroutine

data class SettingsOption(
    val id: String,
    val label: String,
)

/**
 * 通用设置项选择弹窗：胶囊行、选中浅蓝底与蓝描边，最大高度 60% 屏，超出滚动，底部取消。
 */
suspend fun showSettingsOptionPicker(
    context: Context,
    title: String,
    options: List<SettingsOption>,
    selectedIndex: Int = 0,
): SettingsOption? {
    if (options.isEmpty()) return null
    return suspendCancellableCoroutine { cont ->
        val dialog = BottomSheetDialog(
            context,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val root = LayoutInflater.from(context).inflate(
            R.layout.layout_settings_option_picker_bottom_sheet,
            null,
        )
        root.findViewById<TextView>(R.id.settingsOptionPickerTitle).text = title
        val container = root.findViewById<LinearLayout>(R.id.settingsOptionsContainer)

        val density = context.resources.displayMetrics.density
        val strokeSelected = ContextCompat.getColor(context, R.color.download_quality_selected_stroke)
        val bgNormal = ContextCompat.getColor(context, R.color.settings_option_row_bg_normal)
        val bgSelected = ContextCompat.getColor(context, R.color.settings_option_row_bg_selected)
        val labelNormal = MaterialColors.getColor(
            root,
            com.google.android.material.R.attr.colorOnSurface,
            Color.BLACK,
        )
        val elevationNormal = 3f * density

        var selected = selectedIndex.coerceIn(options.indices)
        val cards = mutableListOf<MaterialCardView>()
        val checks = mutableListOf<ImageView>()
        val labels = mutableListOf<TextView>()

        fun applySelection(index: Int) {
            selected = index.coerceIn(options.indices)
            cards.forEachIndexed { i, card ->
                val checked = i == selected
                if (checked) {
                    card.setCardBackgroundColor(bgSelected)
                    card.strokeColor = strokeSelected
                    card.strokeWidth = (1f * density).roundToInt()
                    card.cardElevation = 0f
                    labels[i].setTextColor(strokeSelected)
                    checks.getOrNull(i)?.visibility = View.VISIBLE
                } else {
                    card.setCardBackgroundColor(bgNormal)
                    card.strokeWidth = 0
                    card.cardElevation = 0f
                    labels[i].setTextColor(labelNormal)
                    checks.getOrNull(i)?.visibility = View.GONE
                }
            }
        }

        val gapBottom = (12 * density).roundToInt()
        options.forEachIndexed { index, opt ->
            val card = LayoutInflater.from(context).inflate(
                R.layout.item_settings_option_sheet_row,
                container,
                false,
            ) as MaterialCardView
            val label = card.findViewById<TextView>(R.id.optionLabel)
            label.text = opt.label
            val check = card.findViewById<ImageView>(R.id.optionCheck)
            cards.add(card)
            checks.add(check)
            labels.add(label)

            card.setOnClickListener {
                applySelection(index)
                if (cont.isActive) cont.resume(options[selected])
                dialog.dismiss()
            }

            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply {
                if (index < options.lastIndex) bottomMargin = gapBottom
            }
            card.layoutParams = lp
            container.addView(card)
        }
        applySelection(selected)

        root.findViewById<View>(R.id.settingsOptionPickerCancel).setOnClickListener {
            dialog.dismiss()
        }

        dialog.setContentView(root)
        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<FrameLayout>(
                com.google.android.material.R.id.design_bottom_sheet,
            ) ?: return@setOnShowListener
            val maxH = (context.resources.displayMetrics.heightPixels * 0.6f).roundToInt()
            bottomSheet.layoutParams = bottomSheet.layoutParams.apply { height = maxH }
            BottomSheetBehavior.from(bottomSheet).apply {
                skipCollapsed = true
                this.maxHeight = maxH
                state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        dialog.setCancelable(true)
        dialog.setOnDismissListener {
            if (cont.isActive) cont.resume(null)
        }
        cont.invokeOnCancellation { dialog.dismiss() }
        dialog.show()
    }
}
