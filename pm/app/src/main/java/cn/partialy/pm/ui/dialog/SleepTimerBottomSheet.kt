package cn.partialy.pm.ui.dialog

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.graphics.ColorUtils
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import cn.partialy.pm.R
import cn.partialy.pm.databinding.BottomSheetSleepTimerBinding
import cn.partialy.pm.player.SleepTimerManager
import cn.partialy.pm.player.SleepTimerRules
import cn.partialy.pm.player.SleepTimerState
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.color.MaterialColors
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

object SleepTimerBottomSheet {
    private data class PresetButton(
        val root: LinearLayout,
        val number: TextView,
        val unit: TextView,
    )

    fun show(
        activity: AppCompatActivity,
        sleepTimerManager: SleepTimerManager,
    ) {
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val binding = BottomSheetSleepTimerBinding.inflate(dialog.layoutInflater)
        var updatingInputs = false
        val presetButtons = mutableListOf<Pair<Int, PresetButton>>()
        val primaryColor = MaterialColors.getColor(
            activity,
            com.google.android.material.R.attr.colorPrimary,
            Color.BLUE,
        )
        val defaultTextColor = MaterialColors.getColor(
            activity,
            com.google.android.material.R.attr.colorOnSurfaceVariant,
            Color.DKGRAY,
        )
        val density = activity.resources.displayMetrics.density
        val circleSizePx = (60f * density).roundToInt()
        val borderWidthPx = density.roundToInt().coerceAtLeast(1)
        val selectedBackgroundColor = ColorUtils.setAlphaComponent(primaryColor, 28)

        fun renderPresetButton(button: PresetButton, selected: Boolean) {
            val contentColor = if (selected) primaryColor else defaultTextColor
            button.root.isSelected = selected
            button.root.background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(if (selected) selectedBackgroundColor else Color.TRANSPARENT)
                setStroke(borderWidthPx, contentColor)
            }
            button.number.setTextColor(contentColor)
            button.unit.setTextColor(contentColor)
        }

        fun inputValue(text: CharSequence?, maxValue: Int): Int =
            text?.toString()?.toIntOrNull()?.coerceIn(0, maxValue) ?: 0

        fun selectedMinutes(): Int = SleepTimerRules.toMinutes(
            hours = inputValue(binding.sleepTimerHoursInput.text, 23),
            minutes = inputValue(binding.sleepTimerMinutesInput.text, 59),
        )

        fun renderSelection() {
            if (updatingInputs) return
            val totalMinutes = selectedMinutes()
            val (hours, minutes) = SleepTimerRules.splitMinutes(totalMinutes)
            binding.sleepTimerSelectionSummary.text = when {
                hours == 0 -> activity.getString(R.string.sleep_timer_selection_minutes, minutes)
                minutes == 0 -> activity.getString(R.string.sleep_timer_selection_full_hours, hours)
                else -> activity.getString(R.string.sleep_timer_selection_hours, hours, minutes)
            }
            presetButtons.forEach { (presetMinutes, button) ->
                renderPresetButton(button, selected = presetMinutes == totalMinutes)
            }
        }

        fun setSelection(totalMinutes: Int) {
            val (hours, minutes) = SleepTimerRules.splitMinutes(totalMinutes)
            updatingInputs = true
            binding.sleepTimerHoursInput.setText(hours.toString())
            binding.sleepTimerMinutesInput.setText(minutes.toString())
            updatingInputs = false
            renderSelection()
        }

        fun adjustHours(delta: Int) {
            val hours = (inputValue(binding.sleepTimerHoursInput.text, 23) + delta).coerceIn(0, 23)
            val minutes = inputValue(binding.sleepTimerMinutesInput.text, 59)
            setSelection(SleepTimerRules.toMinutes(hours, minutes))
        }

        fun adjustMinutes(delta: Int) {
            val hours = inputValue(binding.sleepTimerHoursInput.text, 23)
            val minutes = (inputValue(binding.sleepTimerMinutesInput.text, 59) + delta)
                .coerceIn(0, 59)
            setSelection(SleepTimerRules.toMinutes(hours, minutes))
        }

        sleepTimerManager.presets.value.forEach { presetMinutes ->
            val numberView = TextView(activity).apply {
                text = presetMinutes.toString()
                gravity = Gravity.CENTER
                includeFontPadding = false
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            }
            val unitView = TextView(activity).apply {
                setText(R.string.sleep_timer_preset_min_unit)
                gravity = Gravity.CENTER
                includeFontPadding = false
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
            }
            val circle = LinearLayout(activity).apply {
                id = View.generateViewId()
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                isClickable = true
                isFocusable = true
                contentDescription = activity.getString(
                    R.string.sleep_timer_preset_minutes,
                    presetMinutes,
                )
                addView(numberView)
                addView(unitView)
                setOnClickListener { setSelection(presetMinutes) }
            }
            val slot = FrameLayout(activity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    0,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    1f,
                )
                addView(
                    circle,
                    FrameLayout.LayoutParams(circleSizePx, circleSizePx, Gravity.CENTER),
                )
            }
            val button = PresetButton(circle, numberView, unitView)
            renderPresetButton(button, selected = false)
            presetButtons += presetMinutes to button
            binding.sleepTimerPresetContainer.addView(slot)
        }

        val initialState = sleepTimerManager.state.value
        val initialMinutes = if (initialState.active) {
            initialState.durationMinutes
        } else {
            sleepTimerManager.presets.value.getOrElse(1) { 15 }
        }
        setSelection(initialMinutes)
        binding.sleepTimerWaitCurrentSongSwitch.isChecked =
            initialState.active && initialState.waitCurrentSong
        binding.sleepTimerHoursInput.doAfterTextChanged { renderSelection() }
        binding.sleepTimerMinutesInput.doAfterTextChanged { renderSelection() }
        binding.sleepTimerHoursMinus.setOnClickListener { adjustHours(-1) }
        binding.sleepTimerHoursPlus.setOnClickListener { adjustHours(1) }
        binding.sleepTimerMinutesMinus.setOnClickListener { adjustMinutes(-1) }
        binding.sleepTimerMinutesPlus.setOnClickListener { adjustMinutes(1) }

        binding.sleepTimerSheetClose.setOnClickListener { dialog.dismiss() }
        binding.sleepTimerDismiss.setOnClickListener { dialog.dismiss() }
        binding.sleepTimerCancelActive.setOnClickListener { sleepTimerManager.cancelTimer() }
        binding.sleepTimerConfirm.setOnClickListener {
            sleepTimerManager.startTimer(
                minutes = selectedMinutes(),
                waitCurrentSong = binding.sleepTimerWaitCurrentSongSwitch.isChecked,
            )
            dialog.dismiss()
        }

        fun renderState(state: SleepTimerState) {
            binding.sleepTimerActiveCard.visibility = if (state.active) View.VISIBLE else View.GONE
            binding.sleepTimerConfirm.setText(
                if (state.active) R.string.sleep_timer_update else R.string.sleep_timer_start,
            )
            if (state.waitingForSongEnd) {
                binding.sleepTimerActiveTitle.setText(R.string.sleep_timer_waiting_title)
                binding.sleepTimerRemaining.setText(R.string.sleep_timer_waiting_status)
            } else if (state.enabled) {
                binding.sleepTimerActiveTitle.setText(R.string.sleep_timer_active_title)
                val remaining = SleepTimerRules.formatRemaining(state.remainingSeconds)
                binding.sleepTimerRemaining.text = activity.getString(
                    R.string.sleep_timer_remaining_format,
                    remaining,
                )
            }
        }

        renderState(initialState)
        val observationJob = activity.lifecycleScope.launch {
            activity.repeatOnLifecycle(Lifecycle.State.STARTED) {
                sleepTimerManager.state.collect(::renderState)
            }
        }

        dialog.setContentView(binding.root)
        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<FrameLayout>(
                com.google.android.material.R.id.design_bottom_sheet,
            ) ?: return@setOnShowListener
            val maxHeight = (activity.resources.displayMetrics.heightPixels * 0.82f).roundToInt()
            bottomSheet.layoutParams = bottomSheet.layoutParams.apply {
                height = ViewGroup.LayoutParams.WRAP_CONTENT
            }
            BottomSheetBehavior.from(bottomSheet).apply {
                skipCollapsed = true
                this.maxHeight = maxHeight
                state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        dialog.setOnDismissListener { observationJob.cancel() }
        dialog.setCancelable(true)
        dialog.show()
    }
}
