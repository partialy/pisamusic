package cn.partialy.pm.ui.dialog

import android.content.Context
import android.graphics.Rect
import android.view.LayoutInflater
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.core.widget.NestedScrollView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.LayoutBottomRadiusOptionsSheetBinding
import cn.partialy.pm.model.DownloadQualityOption
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.toPlaybackQualityKey
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
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
        val binding = LayoutBottomRadiusOptionsSheetBinding.inflate(dialog.layoutInflater)
        binding.bottomRadiusOptionsSheetTitle.text =
            title ?: context.getString(R.string.playback_quality)
        val initialIndex = options.indexOfFirst {
            it.choice.toPlaybackQualityKey() == selectedQualityKey
        }.takeIf { it >= 0 } ?: 0
        val selection = OptionPickerRows.bind(
            context = context,
            container = binding.bottomRadiusOptionsSheetContainer,
            labels = options.map { it.label },
            selectedIndex = initialIndex,
        )
        var confirmed = false
        binding.bottomRadiusOptionsSheetCancel.setOnClickListener {
            dialog.dismiss()
        }
        binding.bottomRadiusOptionsSheetConfirm.apply {
            text = confirmText ?: context.getString(R.string.dialog_ok)
            setOnClickListener {
                confirmed = true
                if (cont.isActive) cont.resume(options[selection.selectedIndex])
                dialog.dismiss()
            }
        }

        dialog.setContentView(binding.root)
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
        val initialIndex = options.indexOfFirst {
            it.choice.toPlaybackQualityKey() == selectedQualityKey
        }.takeIf { it >= 0 } ?: 0
        val selection = OptionPickerRows.bind(
            context = context,
            container = container,
            labels = options.map { it.label },
            selectedIndex = initialIndex,
        )
        val primaryColor = MaterialColors.getColor(
            content,
            com.google.android.material.R.attr.colorPrimary,
            0,
        )

        var confirmed = false
        val dialog = PmSlotDialog.Builder(context)
            .setContentView(content)
            .setCancelButton(context.getString(R.string.cancel))
            .setConfirmButton(
                text = context.getString(R.string.dialog_ok),
                textColor = primaryColor,
                dismissOnConfirm = false,
            ) { slotDialog ->
                confirmed = true
                if (cont.isActive) cont.resume(options[selection.selectedIndex])
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
