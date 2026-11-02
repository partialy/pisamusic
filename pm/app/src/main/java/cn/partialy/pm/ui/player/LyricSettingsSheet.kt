package cn.partialy.pm.ui.player

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.provider.Settings
import android.view.View
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetDialog
import cn.partialy.pm.R
import cn.partialy.pm.activity.LyricColorPresetsActivity
import cn.partialy.pm.activity.StatusBarLyricSettingsActivity
import cn.partialy.pm.databinding.BottomSheetLyricSettingsBinding
import cn.partialy.pm.statusbarlyric.StatusBarLyricPrefs
import cn.partialy.pm.utils.LyricDisplayPrefs
import kotlin.math.roundToInt

object LyricSettingsSheet {

    fun show(activity: ComponentActivity, onChanged: () -> Unit) {
        val binding = BottomSheetLyricSettingsBinding.inflate(activity.layoutInflater)
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        binding.root.setBackgroundResource(R.drawable.bg_lyric_settings_sheet)
        dialog.setContentView(binding.root)

        val preview = LyricPreviewController(
            binding.lyricSettingsPreview.previewNormalLyrics,
            binding.lyricSettingsPreview.previewKaraokeLyrics,
        )
        fun notifyChanged() {
            preview.applyStyle(
                LyricDisplayPrefs.readStyle(activity),
                LyricDisplayPrefs.isUseWordLyricEnabled(activity),
            )
            onChanged()
        }

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
                    notifyChanged()
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
                    notifyChanged()
                }
            }
        }

        fun updateIntInput(view: TextView, value: Int) {
            val text = value.toString()
            if (view.text?.toString() != text) view.text = text
        }

        fun updateOpacityUi(value: Int) {
            val clamped = value.coerceIn(0, 100)
            binding.lyricSettingsOpacityValueText.text = binding.root.context.getString(
                R.string.common_percent_value,
                clamped,
            )
            if (binding.lyricSettingsOpacitySlider.progress != clamped) {
                binding.lyricSettingsOpacitySlider.progress = clamped
            }
        }

        fun applyFontSizeFromUser(value: Int) {
            val clamped = value.coerceIn(12, 30)
            updateIntInput(binding.lyricSettingsFontSizeInput, clamped)
            if (syncing) return
            val s = LyricDisplayPrefs.readStyle(activity).copy(textSizeSp = clamped.toFloat())
            LyricDisplayPrefs.writeStyle(activity, s)
            notifyChanged()
        }

        fun applyOpacityFromUser(value: Int) {
            val clamped = value.coerceIn(0, 100)
            updateOpacityUi(clamped)
            if (syncing) return
            val s = LyricDisplayPrefs.readStyle(activity).copy(inactiveOpacityPercent = clamped)
            LyricDisplayPrefs.writeStyle(activity, s)
            notifyChanged()
        }

        fun applyCurrentEnlargedDxFromUser(value: Int) {
            val clamped = value.coerceIn(2, 8)
            updateIntInput(binding.lyricSettingsCurrentEnlargedDxInput, clamped)
            if (syncing) return
            val s = LyricDisplayPrefs.readStyle(activity).copy(currentLineEnlargedDxSp = clamped)
            LyricDisplayPrefs.writeStyle(activity, s)
            notifyChanged()
        }

        val fontStepper = LyricSettingsStepper(
            binding.lyricSettingsFontSizeInput,
            binding.lyricSettingsFontSizeMinus,
            binding.lyricSettingsFontSizePlus,
            12..30,
            LyricDisplayPrefs.readStyle(activity).textSizeSp.roundToInt(),
            ::applyFontSizeFromUser,
        )
        val enlargedStepper = LyricSettingsStepper(
            binding.lyricSettingsCurrentEnlargedDxInput,
            binding.lyricSettingsCurrentEnlargedDxMinus,
            binding.lyricSettingsCurrentEnlargedDxPlus,
            2..8,
            LyricDisplayPrefs.readStyle(activity).currentLineEnlargedDxSp,
            ::applyCurrentEnlargedDxFromUser,
        )

        fun loadUiFromPrefs() {
            syncing = true
            LyricDisplayPrefs.ensureStyleColorsMatchPresets(activity)
            val style = LyricDisplayPrefs.readStyle(activity)
            val nr = Color.rgb(
                Color.red(style.normalColorArgb),
                Color.green(style.normalColorArgb),
                Color.blue(style.normalColorArgb),
            )

            fontStepper.setValue(style.textSizeSp.roundToInt())
            updateOpacityUi(style.inactiveOpacityPercent.coerceIn(0, 100))
            enlargedStepper.setValue(style.currentLineEnlargedDxSp)
            binding.lyricSettingsBoldSwitch.isChecked = style.currentLineBold
            binding.lyricSettingsCurrentEnlargedSwitch.isChecked = style.currentLineEnlarged
            binding.lyricSettingsWordScaleSwitch.isChecked = style.wordScaleEnabled
            binding.lyricSettingsUseWordLyricSwitch.isChecked =
                LyricDisplayPrefs.isUseWordLyricEnabled(activity)
            binding.lyricSettingsStatusBarSwitch.isChecked = StatusBarLyricPrefs.isEnabled(activity)

            when (style.alignment) {
                LyricAlignment.START -> binding.lyricSettingsAlignGroup.check(R.id.lyricSettingsAlignStart)
                LyricAlignment.CENTER -> binding.lyricSettingsAlignGroup.check(R.id.lyricSettingsAlignCenter)
                LyricAlignment.END -> binding.lyricSettingsAlignGroup.check(R.id.lyricSettingsAlignEnd)
            }

            rebuildNormalChips(nr)
            rebuildCurrentChips(style.currentColorArgb)
            syncing = false
            notifyChanged()
        }

        binding.lyricSettingsBoldSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (syncing) return@setOnCheckedChangeListener
            val s = LyricDisplayPrefs.readStyle(activity).copy(currentLineBold = isChecked)
            LyricDisplayPrefs.writeStyle(activity, s)
            notifyChanged()
        }

        binding.lyricSettingsStatusBarSettingsButton.setOnClickListener {
            preview.setVisible(false)
            fontStepper.stop()
            enlargedStepper.stop()
            StatusBarLyricSettingsActivity.start(activity)
        }

        val openColorPresets = View.OnClickListener {
            preview.setVisible(false)
            fontStepper.stop()
            enlargedStepper.stop()
            LyricColorPresetsActivity.start(activity)
        }
        binding.lyricSettingsNormalColorPresetsButton.setOnClickListener(openColorPresets)
        binding.lyricSettingsCurrentColorPresetsButton.setOnClickListener(openColorPresets)

        binding.lyricSettingsStatusBarSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (syncing) return@setOnCheckedChangeListener
            if (isChecked && !Settings.canDrawOverlays(activity)) {
                syncing = true
                binding.lyricSettingsStatusBarSwitch.isChecked = false
                syncing = false
                preview.setVisible(false)
                fontStepper.stop()
                enlargedStepper.stop()
                StatusBarLyricSettingsActivity.start(activity)
                return@setOnCheckedChangeListener
            }
            val current = StatusBarLyricPrefs.read(activity)
            StatusBarLyricPrefs.write(activity, current.copy(enabled = isChecked))
        }

        binding.lyricSettingsUseWordLyricSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (syncing) return@setOnCheckedChangeListener
            LyricDisplayPrefs.setUseWordLyricEnabled(activity, isChecked)
            notifyChanged()
        }

        binding.lyricSettingsCurrentEnlargedSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (syncing) return@setOnCheckedChangeListener
            val s = LyricDisplayPrefs.readStyle(activity).copy(currentLineEnlarged = isChecked)
            LyricDisplayPrefs.writeStyle(activity, s)
            notifyChanged()
        }

        binding.lyricSettingsWordScaleSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (syncing) return@setOnCheckedChangeListener
            val s = LyricDisplayPrefs.readStyle(activity).copy(wordScaleEnabled = isChecked)
            LyricDisplayPrefs.writeStyle(activity, s)
            notifyChanged()
        }

        binding.lyricSettingsOpacitySlider.setOnSeekBarChangeListener(
            object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    if (fromUser) applyOpacityFromUser(progress)
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit

                override fun onStopTrackingTouch(seekBar: SeekBar?) {
                    seekBar?.let { applyOpacityFromUser(it.progress) }
                }
            },
        )

        binding.lyricSettingsAlignGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (syncing || !isChecked) return@addOnButtonCheckedListener
            val align = when (checkedId) {
                R.id.lyricSettingsAlignStart -> LyricAlignment.START
                R.id.lyricSettingsAlignEnd -> LyricAlignment.END
                else -> LyricAlignment.CENTER
            }
            val s = LyricDisplayPrefs.readStyle(activity).copy(alignment = align)
            LyricDisplayPrefs.writeStyle(activity, s)
            notifyChanged()
        }

        loadUiFromPrefs()
        LyricSettingsSheetWindow(
            activity, dialog, binding, preview,
            listOf(fontStepper, enlargedStepper),
            ::loadUiFromPrefs,
        ).show()
    }
}
