package cn.partialy.pm.ui.player

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import cn.partialy.pm.R
import cn.partialy.pm.databinding.BottomSheetLyricSettingsBinding
import cn.partialy.pm.utils.LyricDisplayPrefs
import kotlin.math.roundToInt

object LyricSettingsSheet {

    fun show(activity: Activity, onChanged: () -> Unit) {
        val binding = BottomSheetLyricSettingsBinding.inflate(activity.layoutInflater)
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        binding.root.setBackgroundResource(R.drawable.bg_bottom_sheet)
        dialog.setContentView(binding.root)

        val dm = activity.resources.displayMetrics.density
        val selectedChipSize = (22 * dm).toInt().coerceAtLeast(1)
        val normalChipSize = (28 * dm).toInt().coerceAtLeast(1)
        val chipMargin = (6 * dm).toInt()
        val selectedStroke = (2.5f * dm).roundToInt().coerceAtLeast(2)
        val selectedStrokeColor = ContextCompat.getColor(activity, R.color.blue_selected)

        var syncing = true

        fun ovalDrawable(fillColor: Int, selected: Boolean): GradientDrawable {
            return GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(fillColor)
                val stroke = if (selected) selectedStroke else 0
                val strokeColor = if (selected) selectedStrokeColor else Color.TRANSPARENT
                setStroke(stroke, strokeColor)
            }
        }

        fun addColorChip(
            row: LinearLayout,
            fillColor: Int,
            selected: Boolean,
            onClick: () -> Unit,
        ) {
            val v = View(activity).apply {
                val chipSize = if (selected) selectedChipSize else normalChipSize
                layoutParams = LinearLayout.LayoutParams(chipSize, chipSize).apply {
                    marginStart = chipMargin
                    marginEnd = chipMargin
                }
                background = ovalDrawable(fillColor, selected)
                setOnClickListener {
                    if (syncing) return@setOnClickListener
                    onClick()
                }
            }
            row.addView(v)
        }

        fun rebuildNormalChips(selectedRgb: Int) {
            val row = binding.lyricSettingsNormalColorRow
            row.removeAllViews()
            val presets = LyricDisplayPrefs.getNormalColorRgbPresets(activity)
            presets.forEach { rgb ->
                addColorChip(row, rgb, selected = rgb == selectedRgb) {
                    val s = LyricDisplayPrefs.readStyle(activity).copy(
                        normalColorArgb = Color.rgb(Color.red(rgb), Color.green(rgb), Color.blue(rgb)),
                    )
                    LyricDisplayPrefs.writeStyle(activity, s)
                    rebuildNormalChips(rgb)
                    onChanged()
                }
            }
        }

        fun rebuildCurrentChips(selectedArgb: Int) {
            val row = binding.lyricSettingsCurrentColorRow
            row.removeAllViews()
            val presets = LyricDisplayPrefs.getCurrentColorArgbPresets(activity)
            presets.forEach { argb ->
                addColorChip(row, argb, selected = argb == selectedArgb) {
                    val s = LyricDisplayPrefs.readStyle(activity).copy(currentColorArgb = argb)
                    LyricDisplayPrefs.writeStyle(activity, s)
                    rebuildCurrentChips(argb)
                    onChanged()
                }
            }
        }

        fun updateIntInput(view: TextView, value: Int) {
            val text = value.toString()
            if (view.text?.toString() != text) view.text = text
        }

        fun applyFontSizeFromUser(value: Int) {
            val clamped = value.coerceIn(12, 30)
            updateIntInput(binding.lyricSettingsFontSizeInput, clamped)
            if (syncing) return
            val s = LyricDisplayPrefs.readStyle(activity).copy(textSizeSp = clamped.toFloat())
            LyricDisplayPrefs.writeStyle(activity, s)
            onChanged()
        }

        fun applyOpacityFromUser(value: Int) {
            val clamped = value.coerceIn(0, 100)
            updateIntInput(binding.lyricSettingsOpacityInput, clamped)
            if (syncing) return
            val s = LyricDisplayPrefs.readStyle(activity).copy(inactiveOpacityPercent = clamped)
            LyricDisplayPrefs.writeStyle(activity, s)
            onChanged()
        }

        fun applyCurrentEnlargedDxFromUser(value: Int) {
            val clamped = value.coerceIn(2, 8)
            updateIntInput(binding.lyricSettingsCurrentEnlargedDxInput, clamped)
            if (syncing) return
            val s = LyricDisplayPrefs.readStyle(activity).copy(currentLineEnlargedDxSp = clamped)
            LyricDisplayPrefs.writeStyle(activity, s)
            onChanged()
        }

        fun bindNumericInput(
            input: TextView,
            min: Int,
            max: Int,
            fallbackOnInvalid: Int,
            onApply: (Int) -> Unit,
        ) {
            fun commit() {
                val parsed = input.text?.toString()?.trim()?.toIntOrNull()
                if (parsed == null) {
                    updateIntInput(input, fallbackOnInvalid)
                    onApply(fallbackOnInvalid)
                    return
                }
                onApply(parsed.coerceIn(min, max))
            }
            input.setOnFocusChangeListener { _, hasFocus -> if (!hasFocus) commit() }
            input.setOnEditorActionListener { _, actionId, event ->
                val isEnter = event?.keyCode == KeyEvent.KEYCODE_ENTER &&
                    event.action == KeyEvent.ACTION_DOWN
                if (isEnter || actionId == EditorInfo.IME_ACTION_DONE) {
                    commit()
                    true
                } else {
                    false
                }
            }
        }

        fun loadUiFromPrefs() {
            LyricDisplayPrefs.ensureStyleColorsMatchPresets(activity)
            val style = LyricDisplayPrefs.readStyle(activity)
            val nr = Color.rgb(
                Color.red(style.normalColorArgb),
                Color.green(style.normalColorArgb),
                Color.blue(style.normalColorArgb),
            )

            updateIntInput(
                binding.lyricSettingsFontSizeInput,
                style.textSizeSp.roundToInt().coerceIn(12, 30),
            )
            updateIntInput(
                binding.lyricSettingsOpacityInput,
                style.inactiveOpacityPercent.coerceIn(0, 100),
            )
            updateIntInput(
                binding.lyricSettingsCurrentEnlargedDxInput,
                style.currentLineEnlargedDxSp.coerceIn(2, 8),
            )
            binding.lyricSettingsBoldSwitch.isChecked = style.currentLineBold
            binding.lyricSettingsCurrentEnlargedSwitch.isChecked = style.currentLineEnlarged

            when (style.alignment) {
                LyricAlignment.START -> binding.lyricSettingsAlignGroup.check(R.id.lyricSettingsAlignStart)
                LyricAlignment.CENTER -> binding.lyricSettingsAlignGroup.check(R.id.lyricSettingsAlignCenter)
                LyricAlignment.END -> binding.lyricSettingsAlignGroup.check(R.id.lyricSettingsAlignEnd)
            }

            rebuildNormalChips(nr)
            rebuildCurrentChips(style.currentColorArgb)
        }

        binding.lyricSettingsFontSizeMinus.setOnClickListener {
            val current = binding.lyricSettingsFontSizeInput.text?.toString()?.toIntOrNull()
                ?: LyricDisplayPrefs.readStyle(activity).textSizeSp.roundToInt()
            applyFontSizeFromUser(current - 1)
        }

        binding.lyricSettingsFontSizePlus.setOnClickListener {
            val current = binding.lyricSettingsFontSizeInput.text?.toString()?.toIntOrNull()
                ?: LyricDisplayPrefs.readStyle(activity).textSizeSp.roundToInt()
            applyFontSizeFromUser(current + 1)
        }

        binding.lyricSettingsOpacityMinus.setOnClickListener {
            val current = binding.lyricSettingsOpacityInput.text?.toString()?.toIntOrNull()
                ?: LyricDisplayPrefs.readStyle(activity).inactiveOpacityPercent
            applyOpacityFromUser(current - 1)
        }

        binding.lyricSettingsOpacityPlus.setOnClickListener {
            val current = binding.lyricSettingsOpacityInput.text?.toString()?.toIntOrNull()
                ?: LyricDisplayPrefs.readStyle(activity).inactiveOpacityPercent
            applyOpacityFromUser(current + 1)
        }

        binding.lyricSettingsCurrentEnlargedDxMinus.setOnClickListener {
            val current = binding.lyricSettingsCurrentEnlargedDxInput.text?.toString()?.toIntOrNull()
                ?: LyricDisplayPrefs.readStyle(activity).currentLineEnlargedDxSp
            applyCurrentEnlargedDxFromUser(current - 1)
        }

        binding.lyricSettingsCurrentEnlargedDxPlus.setOnClickListener {
            val current = binding.lyricSettingsCurrentEnlargedDxInput.text?.toString()?.toIntOrNull()
                ?: LyricDisplayPrefs.readStyle(activity).currentLineEnlargedDxSp
            applyCurrentEnlargedDxFromUser(current + 1)
        }

        bindNumericInput(
            binding.lyricSettingsFontSizeInput,
            12,
            30,
            fallbackOnInvalid = 20,
            onApply = ::applyFontSizeFromUser,
        )
        bindNumericInput(
            binding.lyricSettingsOpacityInput,
            0,
            100,
            fallbackOnInvalid = 50,
            onApply = ::applyOpacityFromUser,
        )
        bindNumericInput(
            binding.lyricSettingsCurrentEnlargedDxInput,
            2,
            8,
            fallbackOnInvalid = 4,
            onApply = ::applyCurrentEnlargedDxFromUser,
        )

        binding.lyricSettingsBoldSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (syncing) return@setOnCheckedChangeListener
            val s = LyricDisplayPrefs.readStyle(activity).copy(currentLineBold = isChecked)
            LyricDisplayPrefs.writeStyle(activity, s)
            onChanged()
        }

        binding.lyricSettingsCurrentEnlargedSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (syncing) return@setOnCheckedChangeListener
            val s = LyricDisplayPrefs.readStyle(activity).copy(currentLineEnlarged = isChecked)
            LyricDisplayPrefs.writeStyle(activity, s)
            onChanged()
        }

        binding.lyricSettingsAlignGroup.setOnCheckedChangeListener { _, checkedId ->
            if (syncing) return@setOnCheckedChangeListener
            val align = when (checkedId) {
                R.id.lyricSettingsAlignStart -> LyricAlignment.START
                R.id.lyricSettingsAlignEnd -> LyricAlignment.END
                else -> LyricAlignment.CENTER
            }
            val s = LyricDisplayPrefs.readStyle(activity).copy(alignment = align)
            LyricDisplayPrefs.writeStyle(activity, s)
            onChanged()
        }

        loadUiFromPrefs()
        syncing = false

        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<FrameLayout>(
                com.google.android.material.R.id.design_bottom_sheet,
            ) ?: return@setOnShowListener
            val maxH = (activity.resources.displayMetrics.heightPixels * 0.62f).roundToInt()
            bottomSheet.layoutParams = bottomSheet.layoutParams.apply { height = maxH }
            BottomSheetBehavior.from(bottomSheet).apply {
                skipCollapsed = true
                maxHeight = maxH
                state = BottomSheetBehavior.STATE_EXPANDED
            }
        }

        dialog.show()
    }
}
