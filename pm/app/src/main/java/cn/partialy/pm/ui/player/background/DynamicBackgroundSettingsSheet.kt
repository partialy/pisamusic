package cn.partialy.pm.ui.player.background

import android.widget.SeekBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.databinding.BottomSheetDynamicBackgroundSettingsBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.utils.SongCoverUrl
import com.google.android.material.bottomsheet.BottomSheetDialog
import java.util.Locale

/** 所有编辑仅改变本次弹窗的草稿，保存之前不触碰运行配置。 */
internal object DynamicBackgroundSettingsSheet {
    fun show(activity: ComponentActivity, song: SongInfo?, onSaved: () -> Unit) {
        val dialog = BottomSheetDialog(
            activity, com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val binding = BottomSheetDynamicBackgroundSettingsBinding.inflate(dialog.layoutInflater)
        dialog.setContentView(binding.root)
        var draft = SettingsPrefs.getPlayerFlowBackgroundConfig(activity)
        var syncing = false
        val preview = PlayerBackgroundController(
            binding.previewTexture, binding.previewFlow, activity.lifecycleScope,
        )
        binding.previewFlow.setPreviewMode(true)
        preview.setConfig(draft)
        if (song == null) preview.bindFallback()
        else preview.bind(
            songKey = "${song.type}:${song.id}",
            model = SongCoverUrl.getSongCoverData(song, SongCoverUrl.SIZE_XLARGE),
        )

        fun formatSpeed(value: Int) = String.format(Locale.getDefault(), "%.1f×", value / 10f)
        fun updatePreview() { preview.setConfig(draft.normalized()) }
        fun setupSlider(
            slider: SeekBar, label: TextView, speed: Boolean = false,
            change: (Int) -> Unit,
        ) {
            val minimum = if (speed) 5 else 0
            val step = if (speed) 1 else 5
            slider.max = if (speed) 15 else 20
            slider.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    val number = minimum + progress * step
                    val value = if (speed) formatSpeed(number) else "$number%"
                    label.text = value
                    androidx.core.view.ViewCompat.setStateDescription(slider, value)
                    if (fromUser && !syncing) {
                        change(number)
                        updatePreview()
                    }
                }
                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
            })
        }
        setupSlider(binding.speedSlider, binding.speedValue, true) {
            draft = draft.copy(speedX10 = it)
        }
        setupSlider(binding.motionSlider, binding.motionValue) {
            draft = draft.copy(motionAmplitudePercent = it)
        }
        setupSlider(binding.glowSlider, binding.glowValue) {
            draft = draft.copy(glowIntensityPercent = it)
        }
        setupSlider(binding.brightnessSlider, binding.brightnessValue) {
            draft = draft.copy(brightnessPercent = it)
        }
        setupSlider(binding.saturationSlider, binding.saturationValue) {
            draft = draft.copy(saturationPercent = it)
        }
        fun loadDraft() {
            syncing = true
            binding.speedSlider.progress = draft.speedX10 - 5
            binding.motionSlider.progress = draft.motionAmplitudePercent / 5
            binding.glowSlider.progress = draft.glowIntensityPercent / 5
            binding.brightnessSlider.progress = draft.brightnessPercent / 5
            binding.saturationSlider.progress = draft.saturationPercent / 5
            // 取值未变化时 SeekBar 不回调，也须刷新默认/恢复后的全部摘要。
            binding.speedValue.text = formatSpeed(draft.speedX10)
            binding.motionValue.text = "${draft.motionAmplitudePercent}%"
            binding.glowValue.text = "${draft.glowIntensityPercent}%"
            binding.brightnessValue.text = "${draft.brightnessPercent}%"
            binding.saturationValue.text = "${draft.saturationPercent}%"
            binding.colorModeGroup.check(when (draft.colorMode) {
                PlayerFlowColorMode.FOLLOW_COVER -> R.id.modeFollow
                PlayerFlowColorMode.SOFT -> R.id.modeSoft
                PlayerFlowColorMode.VIVID -> R.id.modeVivid
            })
            syncing = false
            updatePreview()
        }
        binding.colorModeGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!syncing && isChecked) {
                draft = draft.copy(colorMode = when (checkedId) {
                    R.id.modeSoft -> PlayerFlowColorMode.SOFT
                    R.id.modeVivid -> PlayerFlowColorMode.VIVID
                    else -> PlayerFlowColorMode.FOLLOW_COVER
                })
                updatePreview()
            }
        }
        binding.restoreDefaults.setOnClickListener {
            draft = PlayerFlowBackgroundConfig()
            loadDraft()
        }
        binding.cancelButton.setOnClickListener { dialog.dismiss() }
        binding.saveButton.setOnClickListener {
            SettingsPrefs.setPlayerFlowBackgroundConfig(activity, draft)
            onSaved()
            dialog.dismiss()
        }
        loadDraft()
        DynamicBackgroundSettingsWindow(activity, dialog, binding, preview).show()
    }
}
