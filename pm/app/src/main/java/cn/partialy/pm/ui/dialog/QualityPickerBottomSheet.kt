package cn.partialy.pm.ui.dialog

import android.content.Context
import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import cn.partialy.pm.R
import cn.partialy.pm.model.DownloadQualityOption
import cn.partialy.pm.model.toPlaybackQualityKey
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.card.MaterialCardView
import com.google.android.material.color.MaterialColors
import kotlin.coroutines.resume
import kotlin.math.roundToInt
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * 音质选择底部弹窗：与设置选项同款胶囊行样式，纵向滚动、最大高度约 60% 屏。
 */
suspend fun showDownloadQualityPicker(
    context: Context,
    songSubtitle: String,
    options: List<DownloadQualityOption>,
    title: CharSequence? = null,
    confirmText: CharSequence? = null,
    selectedQualityKey: String? = null,
): DownloadQualityOption? {
    if (options.isEmpty()) return null
    return suspendCancellableCoroutine { cont ->
        val dialog = BottomSheetDialog(
            context,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val root = LayoutInflater.from(context).inflate(
            R.layout.layout_quality_picker_bottom_sheet,
            null,
        )
        title?.let { root.findViewById<TextView>(R.id.qualityPickerTitle).text = it }
        root.findViewById<TextView>(R.id.qualityPickerSubtitle).text = songSubtitle
        confirmText?.let { root.findViewById<TextView>(R.id.qualityPickerConfirm).text = it }
        val container = root.findViewById<LinearLayout>(R.id.qualityOptionsContainer)
        val density = context.resources.displayMetrics.density
        val strokeSelected = ContextCompat.getColor(context, R.color.download_quality_selected_stroke)
        val bgNormal = ContextCompat.getColor(context, R.color.settings_option_row_bg_normal)
        val bgSelected = ContextCompat.getColor(context, R.color.settings_option_row_bg_selected)
        val labelNormal = MaterialColors.getColor(
            root,
            com.google.android.material.R.attr.colorOnSurface,
            Color.BLACK,
        )
        var selectedIndex = options.indexOfFirst {
            it.choice.toPlaybackQualityKey() == selectedQualityKey
        }.takeIf { it >= 0 } ?: 0
        val cards = mutableListOf<MaterialCardView>()
        val checks = mutableListOf<ImageView>()
        val labels = mutableListOf<TextView>()

        fun applySelection(index: Int) {
            selectedIndex = index.coerceIn(options.indices)
            cards.forEachIndexed { i, card ->
                val checked = i == selectedIndex
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
            card.setOnClickListener { applySelection(index) }
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply {
                if (index < options.lastIndex) bottomMargin = gapBottom
            }
            card.layoutParams = lp
            container.addView(card)
        }
        applySelection(selectedIndex)

        var confirmed = false
        root.findViewById<ImageButton>(R.id.qualityPickerClose).setOnClickListener {
            dialog.dismiss()
        }
        root.findViewById<View>(R.id.qualityPickerConfirm).setOnClickListener {
            confirmed = true
            if (cont.isActive) cont.resume(options[selectedIndex])
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
            if (cont.isActive && !confirmed) cont.resume(null)
        }
        cont.invokeOnCancellation { dialog.dismiss() }
        dialog.show()
    }
}
