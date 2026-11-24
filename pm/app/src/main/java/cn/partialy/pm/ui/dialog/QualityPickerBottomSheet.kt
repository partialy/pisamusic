package cn.partialy.pm.ui.dialog

import android.app.Dialog
import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.R
import cn.partialy.pm.activity.FeedbackActivity
import cn.partialy.pm.activity.LoginActivity
import cn.partialy.pm.databinding.LayoutBottomRadiusOptionsSheetBinding
import cn.partialy.pm.model.DownloadQualityChoice
import cn.partialy.pm.model.DownloadQualityOption
import cn.partialy.pm.model.MusicQualityAccessPolicy
import cn.partialy.pm.model.MusicQualityAccessState
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.downloadOptionsForSongType
import cn.partialy.pm.model.playbackQualityChoiceFromKey
import cn.partialy.pm.model.toPlaybackQualityKey
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.utils.SettingsPrefs
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.color.MaterialColors
import kotlin.coroutines.resume
import kotlin.math.roundToInt
import kotlinx.coroutines.suspendCancellableCoroutine

sealed interface DefaultDownloadQualitySelection {
    object AskEveryTime : DefaultDownloadQualitySelection
    data class Choice(val option: DownloadQualityOption) : DefaultDownloadQualitySelection
}

internal fun Context.readMusicQualityAccessState(): MusicQualityAccessState {
    val session = AccountSessionStore.read(this)
    return MusicQualityAccessState(session.loggedIn, session.vipActive)
}

internal fun Context.openQualityRestrictionAction(access: MusicQualityAccessState) {
    if (access.loggedIn) FeedbackActivity.startForQualityUnlock(this)
    else LoginActivity.start(this)
}

internal fun effectivePlaybackQualityChoice(
    context: Context,
    type: SongType,
    access: MusicQualityAccessState = context.readMusicQualityAccessState(),
): DownloadQualityChoice? {
    val savedChoice = playbackQualityChoiceFromKey(SettingsPrefs.getPlaybackQualityKey(context, type))
    return MusicQualityAccessPolicy.allowedChoiceOrFallback(type, savedChoice, access)
}

internal fun formatQualityOptionLabel(
    context: Context,
    type: SongType,
    choice: DownloadQualityChoice?,
): String {
    val labelRes = choice?.let { target ->
        downloadOptionsForSongType(type).firstOrNull { it.choice == target }?.labelRes
    } ?: return ""
    return context.getString(labelRes)
}

internal fun qualitySourceDisplayName(context: Context, type: SongType): String = when (type) {
    SongType.KG -> context.getString(R.string.download_details_source_kg)
    SongType.WY -> context.getString(R.string.download_details_source_wy)
    else -> type.name
}

suspend fun showDefaultDownloadQualityPicker(
    context: Context,
    title: CharSequence,
    askLabel: String,
    options: List<DownloadQualityOption>,
    selectedQualityKey: String? = null,
    onRestrictedOptionClick: ((DownloadQualityOption) -> Unit)? = null,
): DefaultDownloadQualitySelection? {
    val sheetOptions = buildList {
        add(SettingsOption(id = MusicQualityAccessPolicy.DOWNLOAD_QUALITY_ASK, label = askLabel))
        options.forEach { option ->
            add(
                SettingsOption(
                    id = option.choice.toPlaybackQualityKey(),
                    label = context.getString(option.labelRes),
                    enabled = option.enabled,
                    badge = option.badgeRes?.let { context.getString(it) },
                ),
            )
        }
    }
    val initialIndex = if (selectedQualityKey.isNullOrBlank()) {
        0
    } else {
        options.indexOfFirst { it.choice.toPlaybackQualityKey() == selectedQualityKey }
            .let { idx -> if (idx >= 0) idx + 1 else 0 }
    }
    return showBottomQualitySheet(
        context = context,
        title = title,
        confirmText = null,
        bindSelection = { dialog, container ->
            OptionPickerRows.bindOptions(
                context = context,
                container = container,
                options = sheetOptions,
                selectedIndex = initialIndex,
                onDisabledOptionClick = onRestrictedOptionClick?.let { action ->
                    { picked ->
                        val optionIndex = sheetOptions.indexOf(picked) - 1
                        options.getOrNull(optionIndex)?.let { option ->
                            dialog.dismiss()
                            action(option)
                        }
                    }
                },
            )
        },
        resolveConfirmed = { selectedIndex ->
            when {
                selectedIndex == 0 -> DefaultDownloadQualitySelection.AskEveryTime
                selectedIndex > 0 -> options.getOrNull(selectedIndex - 1)
                    ?.takeIf { it.enabled }
                    ?.let { DefaultDownloadQualitySelection.Choice(it) }
                else -> null
            }
        },
    )
}

@Suppress("UNUSED_PARAMETER")
suspend fun showDownloadQualityPicker(
    context: Context,
    songSubtitle: String,
    options: List<DownloadQualityOption>,
    title: CharSequence? = null,
    confirmText: CharSequence? = null,
    selectedQualityKey: String? = null,
    song: SongInfo? = null,
    onRestrictedOptionClick: ((DownloadQualityOption) -> Unit)? = null,
): DownloadQualityOption? {
    if (options.isEmpty()) return null
    val initialIndex = options.indexOfFirst {
        it.choice.toPlaybackQualityKey() == selectedQualityKey
    }
    return showBottomQualitySheet(
        context = context,
        title = title ?: context.getString(R.string.playback_quality),
        confirmText = confirmText,
        bindSelection = { dialog, container ->
            OptionPickerRows.bindQualityOptions(
                context = context,
                container = container,
                options = options,
                selectedIndex = initialIndex,
                onDisabledOptionClick = onRestrictedOptionClick?.let { action ->
                    { option ->
                        dialog.dismiss()
                        action(option)
                    }
                },
            )
        },
        resolveConfirmed = { selectedIndex ->
            options.getOrNull(selectedIndex)?.takeIf { it.enabled }
        },
    )
}

private suspend fun <T> showBottomQualitySheet(
    context: Context,
    title: CharSequence,
    confirmText: CharSequence?,
    bindSelection: (BottomSheetDialog, LinearLayout) -> OptionPickerRows,
    resolveConfirmed: (Int) -> T?,
): T? = suspendCancellableCoroutine { cont ->
    val dialog = BottomSheetDialog(
        context,
        R.style.ThemeOverlay_Pm_BottomSheetDialog,
    )
    val binding = LayoutBottomRadiusOptionsSheetBinding.inflate(dialog.layoutInflater)
    binding.bottomRadiusOptionsSheetTitle.text = title
    val selection = bindSelection(dialog, binding.bottomRadiusOptionsSheetContainer)
    var confirmed = false
    binding.bottomRadiusOptionsSheetCancel.setOnClickListener {
        dialog.dismiss()
    }
    binding.bottomRadiusOptionsSheetConfirm.apply {
        text = confirmText ?: context.getString(R.string.dialog_ok)
        setOnClickListener {
            val result = resolveConfirmed(selection.selectedIndex) ?: return@setOnClickListener
            confirmed = true
            if (cont.isActive) cont.resume(result)
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
    PmMessage.register(dialog)
}

suspend fun showDownloadQualityConfirmDialog(
    context: Context,
    songSubtitle: String,
    options: List<DownloadQualityOption>,
    selectedQualityKey: String? = null,
    song: SongInfo? = null,
    onRestrictedOptionClick: ((DownloadQualityOption) -> Unit)? = null,
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
        val restrictedAction = onRestrictedOptionClick
        val selection = OptionPickerRows.bindQualityOptions(
            context = context,
            container = container,
            options = options,
            selectedIndex = initialIndex,
            onDisabledOptionClick = if (restrictedAction == null) null else {
                { option ->
                    dialog.dismiss()
                    restrictedAction(option)
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
