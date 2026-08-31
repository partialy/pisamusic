package cn.partialy.pm.ui.dialog

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import cn.partialy.pm.R
import cn.partialy.pm.databinding.BottomSheetSleepTimerPresetsBinding
import cn.partialy.pm.player.SleepTimerManager
import cn.partialy.pm.player.SleepTimerRules
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlin.math.roundToInt

object SleepTimerPresetSettingsBottomSheet {
    fun show(
        activity: AppCompatActivity,
        sleepTimerManager: SleepTimerManager,
        onSaved: () -> Unit,
    ) {
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val binding = BottomSheetSleepTimerPresetsBinding.inflate(dialog.layoutInflater)
        val inputLayouts: List<TextInputLayout> = listOf(
            binding.sleepTimerPresetSlot1Layout,
            binding.sleepTimerPresetSlot2Layout,
            binding.sleepTimerPresetSlot3Layout,
            binding.sleepTimerPresetSlot4Layout,
        )
        val inputs: List<TextInputEditText> = listOf(
            binding.sleepTimerPresetSlot1Input,
            binding.sleepTimerPresetSlot2Input,
            binding.sleepTimerPresetSlot3Input,
            binding.sleepTimerPresetSlot4Input,
        )

        sleepTimerManager.presets.value.forEachIndexed { index, minutes ->
            inputs[index].setText(minutes.toString())
            inputs[index].setSelectAllOnFocus(true)
        }

        binding.sleepTimerPresetClose.setOnClickListener { dialog.dismiss() }
        binding.sleepTimerPresetCancel.setOnClickListener { dialog.dismiss() }
        binding.sleepTimerPresetSave.setOnClickListener {
            val values = inputs.map { it.text?.toString()?.toIntOrNull() }
            var valid = true
            values.forEachIndexed { index, value ->
                val inRange = value != null &&
                    value in SleepTimerRules.MIN_MINUTES..SleepTimerRules.MAX_MINUTES
                inputLayouts[index].error = if (inRange) {
                    null
                } else {
                    activity.getString(R.string.sleep_timer_preset_invalid)
                }
                if (!inRange) valid = false
            }
            if (!valid) return@setOnClickListener
            sleepTimerManager.setPresets(values.filterNotNull())
            onSaved()
            dialog.dismiss()
        }

        dialog.setContentView(binding.root)
        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<FrameLayout>(
                com.google.android.material.R.id.design_bottom_sheet,
            ) ?: return@setOnShowListener
            val maxHeight = (activity.resources.displayMetrics.heightPixels * 0.78f).roundToInt()
            bottomSheet.layoutParams = bottomSheet.layoutParams.apply {
                height = ViewGroup.LayoutParams.WRAP_CONTENT
            }
            BottomSheetBehavior.from(bottomSheet).apply {
                skipCollapsed = true
                this.maxHeight = maxHeight
                state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        dialog.setCancelable(true)
        dialog.show()
    }
}
