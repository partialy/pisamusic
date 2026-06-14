package cn.partialy.pm.ui.dialog

import android.content.Context
import android.widget.FrameLayout
import cn.partialy.pm.databinding.LayoutBottomRadiusOptionsSheetBinding
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlin.coroutines.resume
import kotlin.math.roundToInt
import kotlinx.coroutines.suspendCancellableCoroutine

data class SettingsOption(
    val id: String,
    val label: String,
)

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
        val binding = LayoutBottomRadiusOptionsSheetBinding.inflate(dialog.layoutInflater)
        binding.bottomRadiusOptionsSheetTitle.text = title
        val selection = OptionPickerRows.bind(
            context = context,
            container = binding.bottomRadiusOptionsSheetContainer,
            labels = options.map { it.label },
            selectedIndex = selectedIndex,
        )

        binding.bottomRadiusOptionsSheetCancel.setOnClickListener {
            dialog.dismiss()
        }
        binding.bottomRadiusOptionsSheetConfirm.setOnClickListener {
            if (cont.isActive) cont.resume(options[selection.selectedIndex])
            dialog.dismiss()
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
            if (cont.isActive) cont.resume(null)
        }
        cont.invokeOnCancellation { dialog.dismiss() }
        dialog.show()
    }
}
