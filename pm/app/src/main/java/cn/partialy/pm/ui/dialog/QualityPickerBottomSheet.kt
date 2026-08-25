package cn.partialy.pm.ui.dialog

import android.app.Dialog
import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
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
    onLoginRequired: (() -> Unit)? = null,
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
        }
        val loginAction = onLoginRequired
        val selection = OptionPickerRows.bindQualityOptions(
            context = context,
            container = binding.bottomRadiusOptionsSheetContainer,
            options = options,
            selectedIndex = initialIndex,
            onDisabledOptionClick = if (loginAction == null) null else {
                {
                    dialog.dismiss()
                    loginAction()
                }
            },
        )
        var confirmed = false
        binding.bottomRadiusOptionsSheetCancel.setOnClickListener {
            dialog.dismiss()
        }
        binding.bottomRadiusOptionsSheetConfirm.apply {
            text = confirmText ?: context.getString(R.string.dialog_ok)
            setOnClickListener {
                val selected = options.getOrNull(selection.selectedIndex)
                    ?.takeIf { it.enabled }
                    ?: return@setOnClickListener
                confirmed = true
                if (cont.isActive) cont.resume(selected)
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
    onLoginRequired: (() -> Unit)? = null,
): DownloadQualityOption? {
    if (options.isEmpty()) return null
    return suspendCancellableCoroutine { cont ->
        val inflater = LayoutInflater.from(context)
        val header = inflater.inflate(
            R.layout.include_song_info_header,
            null,
            false,
        )
        val headerMarginHorizontal = (20f * context.resources.displayMetrics.density).roundToInt()
        val headerMarginTop = (22f * context.resources.displayMetrics.density).roundToInt()
        header.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply {
            leftMargin = headerMarginHorizontal
            rightMargin = headerMarginHorizontal
            topMargin = headerMarginTop
        }
        SongInfoHeaderBinder.bind(
            root = header,
            song = song,
            fallbackTitle = context.getString(R.string.download_current_song),
            fallbackSubtitle = songSubtitle,
        )

        val content = inflater.inflate(
            R.layout.dialog_download_quality_picker,
            null,
            false,
        )
        val container = content.findViewById<LinearLayout>(R.id.downloadQualityOptionsContainer)
        val initialIndex = options.indexOfFirst {
            it.choice.toPlaybackQualityKey() == selectedQualityKey
        }
        lateinit var dialog: Dialog
        val loginAction = onLoginRequired
        val selection = OptionPickerRows.bindQualityOptions(
            context = context,
            container = container,
            options = options,
            selectedIndex = initialIndex,
            onDisabledOptionClick = if (loginAction == null) null else {
                {
                    dialog.dismiss()
                    loginAction()
                }
            },
        )
        val primaryColor = MaterialColors.getColor(
            content,
            com.google.android.material.R.attr.colorPrimary,
            0,
        )

        var confirmed = false
        dialog = PmSlotDialog.Builder(context)
            .setHeaderView(header)
            .setContentView(content)
            .setCancelButton(context.getString(R.string.cancel))
            .setConfirmButton(
                text = context.getString(R.string.dialog_ok),
                textColor = primaryColor,
                dismissOnConfirm = false,
            ) { slotDialog ->
                val selected = options.getOrNull(selection.selectedIndex)
                    ?.takeIf { it.enabled }
                    ?: return@setConfirmButton
                confirmed = true
                if (cont.isActive) cont.resume(selected)
                slotDialog.dismiss()
            }
            .show()

        dialog.setOnDismissListener {
            if (cont.isActive && !confirmed) cont.resume(null)
        }
        cont.invokeOnCancellation { dialog.dismiss() }
    }
}
