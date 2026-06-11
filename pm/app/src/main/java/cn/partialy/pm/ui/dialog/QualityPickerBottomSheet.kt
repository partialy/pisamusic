package cn.partialy.pm.ui.dialog

import android.content.Context
import android.graphics.Color
import android.graphics.Rect
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.widget.NestedScrollView
import cn.partialy.pm.R
import cn.partialy.pm.model.DownloadQualityOption
import cn.partialy.pm.model.SongInfo
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
    song: SongInfo? = null,
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
        SongInfoHeaderBinder.bind(
            root = root,
            song = song,
            fallbackTitle = title ?: context.getString(R.string.download_current_song),
            fallbackSubtitle = songSubtitle,
        )
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
    song: SongInfo? = null,
): DownloadQualityOption? {
    if (options.isEmpty()) return null
    return suspendCancellableCoroutine { cont ->
        val content = LayoutInflater.from(context).inflate(
            R.layout.dialog_download_quality_picker,
            null,
            false,
        )
        SongInfoHeaderBinder.bind(
            root = content,
            song = song,
            fallbackTitle = context.getString(R.string.download_current_song),
            fallbackSubtitle = songSubtitle,
        )
        val container = content.findViewById<LinearLayout>(R.id.downloadQualityOptionsContainer)
        val optionsScroll = content.findViewById<NestedScrollView>(
            R.id.downloadQualityOptionsScroll,
        )
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

        constrainDownloadQualityDialogHeight(
            dialog = dialog,
            content = content,
            optionsScroll = optionsScroll,
            optionsContainer = container,
        )
        dialog.setOnDismissListener {
            if (cont.isActive && !confirmed) cont.resume(null)
        }
        cont.invokeOnCancellation { dialog.dismiss() }
    }
}

private fun constrainDownloadQualityDialogHeight(
    dialog: android.app.Dialog,
    content: View,
    optionsScroll: NestedScrollView,
    optionsContainer: LinearLayout,
) {
    content.post {
        val window = dialog.window ?: return@post
        val visibleFrame = Rect()
        window.decorView.getWindowVisibleDisplayFrame(visibleFrame)

        val density = content.resources.displayMetrics.density
        val verticalMargin = (24f * density).roundToInt()
        val maxDialogHeight = (visibleFrame.height() - verticalMargin * 2).coerceAtLeast(0)
        val buttonContainer = dialog.findViewById<View>(R.id.buttonContainer)
        val divider = dialog.findViewById<View>(R.id.horizontalDivider)
        val fixedHeight = (content.measuredHeight - optionsScroll.measuredHeight).coerceAtLeast(0) +
            buttonContainer.measuredHeight +
            divider.measuredHeight
        val availableOptionsHeight = (maxDialogHeight - fixedHeight).coerceAtLeast(0)
        val naturalOptionsHeight = optionsContainer.measuredHeight

        if (naturalOptionsHeight <= availableOptionsHeight) return@post

        val firstRowHeight = optionsContainer.getChildAt(0)?.measuredHeight ?: 0
        val preferredMinimumHeight = firstRowHeight * 3
        optionsScroll.minimumHeight = preferredMinimumHeight.coerceAtMost(availableOptionsHeight)
        val targetHeight = availableOptionsHeight.coerceAtMost(naturalOptionsHeight)
        optionsScroll.layoutParams = optionsScroll.layoutParams.apply {
            height = targetHeight
        }
        optionsScroll.requestLayout()
    }
}
