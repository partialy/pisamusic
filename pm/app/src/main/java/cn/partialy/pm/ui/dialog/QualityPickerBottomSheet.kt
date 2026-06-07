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

@Suppress("UNUSED_PARAMETER")
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
        root.findViewById<TextView>(R.id.qualityPickerSubtitle).apply {
            text = songSubtitle
            visibility = if (songSubtitle.isBlank()) View.GONE else View.VISIBLE
        }
        val container = root.findViewById<LinearLayout>(R.id.qualityOptionsContainer)
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
                card.strokeWidth = 0
                card.cardElevation = 0f
                labels[i].setTextColor(labelNormal)
                checks.getOrNull(i)?.visibility = if (checked) View.VISIBLE else View.GONE
            }
        }

        var confirmed = false
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
                confirmed = true
                if (cont.isActive) cont.resume(options[selectedIndex])
                dialog.dismiss()
            }
            card.layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
            container.addView(card)
        }
        applySelection(selectedIndex)

        root.findViewById<View>(R.id.qualityPickerCancel).setOnClickListener {
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

suspend fun showDownloadQualityConfirmDialog(
    context: Context,
    songSubtitle: String,
    options: List<DownloadQualityOption>,
    selectedQualityKey: String? = null,
): DownloadQualityOption? {
    if (options.isEmpty()) return null
    return suspendCancellableCoroutine { cont ->
        val content = LayoutInflater.from(context).inflate(
            R.layout.dialog_download_quality_picker,
            null,
            false,
        )
        content.findViewById<TextView>(R.id.downloadQualitySubtitle).apply {
            text = songSubtitle
            visibility = if (songSubtitle.isBlank()) View.GONE else View.VISIBLE
        }
        val container = content.findViewById<LinearLayout>(R.id.downloadQualityOptionsContainer)
        val labelNormal = MaterialColors.getColor(
            content,
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
                card.strokeWidth = 0
                card.cardElevation = 0f
                labels[i].setTextColor(labelNormal)
                checks.getOrNull(i)?.visibility = if (checked) View.VISIBLE else View.GONE
            }
        }

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
            card.layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
            container.addView(card)
        }
        applySelection(selectedIndex)

        var confirmed = false
        val dialog = PmSlotDialog.Builder(context)
            .setContentView(content)
            .setCancelButton(context.getString(R.string.cancel))
            .setConfirmButton(
                text = context.getString(R.string.dialog_ok),
                dismissOnConfirm = false,
            ) { slotDialog ->
                confirmed = true
                if (cont.isActive) cont.resume(options[selectedIndex])
                slotDialog.dismiss()
            }
            .show()

        dialog.setOnDismissListener {
            if (cont.isActive && !confirmed) cont.resume(null)
        }
        cont.invokeOnCancellation { dialog.dismiss() }
    }
}
