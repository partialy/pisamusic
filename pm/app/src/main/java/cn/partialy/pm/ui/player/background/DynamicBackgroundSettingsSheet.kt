package cn.partialy.pm.ui.player.background

import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.databinding.BottomSheetDynamicBackgroundSettingsBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.utils.SongCoverUrl
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.slider.Slider
import java.util.Locale
import kotlin.math.roundToInt

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
        var closed = false
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
        fun updateLabel(label: TextView, title: Int, value: String) {
            label.text = activity.getString(
                R.string.dynamic_background_parameter_value, activity.getString(title), value,
            )
        }
        fun updatePreview() { preview.setConfig(draft.normalized()) }
        fun setupSlider(
            slider: Slider, label: TextView, title: Int, speed: Boolean = false,
            change: (Int) -> Unit,
        ) {
            slider.valueFrom = if (speed) 5f else 0f
            slider.valueTo = if (speed) 20f else 100f
            slider.stepSize = if (speed) 1f else 5f
            slider.setLabelFormatter { if (speed) formatSpeed(it.roundToInt()) else "${it.roundToInt()}%" }
            slider.addOnChangeListener { _, value, fromUser ->
                val number = value.roundToInt()
                updateLabel(label, title, if (speed) formatSpeed(number) else "$number%")
                if (fromUser && !syncing) {
                    change(number)
                    updatePreview()
                }
            }
        }
        setupSlider(binding.speedSlider, binding.speedLabel, R.string.dynamic_background_speed, true) {
            draft = draft.copy(speedX10 = it)
        }
        setupSlider(binding.motionSlider, binding.motionLabel, R.string.dynamic_background_motion) {
            draft = draft.copy(motionAmplitudePercent = it)
        }
        setupSlider(binding.glowSlider, binding.glowLabel, R.string.dynamic_background_glow) {
            draft = draft.copy(glowIntensityPercent = it)
        }
        setupSlider(binding.brightnessSlider, binding.brightnessLabel, R.string.dynamic_background_brightness) {
            draft = draft.copy(brightnessPercent = it)
        }
        setupSlider(binding.saturationSlider, binding.saturationLabel, R.string.dynamic_background_saturation) {
            draft = draft.copy(saturationPercent = it)
        }
        fun loadDraft() {
            syncing = true
            binding.speedSlider.value = draft.speedX10.toFloat()
            binding.motionSlider.value = draft.motionAmplitudePercent.toFloat()
            binding.glowSlider.value = draft.glowIntensityPercent.toFloat()
            binding.brightnessSlider.value = draft.brightnessPercent.toFloat()
            binding.saturationSlider.value = draft.saturationPercent.toFloat()
            // 初始值可能等于 Slider 默认值，也要完整刷新标签。
            updateLabel(binding.speedLabel, R.string.dynamic_background_speed, formatSpeed(draft.speedX10))
            updateLabel(binding.motionLabel, R.string.dynamic_background_motion, "${draft.motionAmplitudePercent}%")
            updateLabel(binding.glowLabel, R.string.dynamic_background_glow, "${draft.glowIntensityPercent}%")
            updateLabel(binding.brightnessLabel, R.string.dynamic_background_brightness, "${draft.brightnessPercent}%")
            updateLabel(binding.saturationLabel, R.string.dynamic_background_saturation, "${draft.saturationPercent}%")
            binding.colorModeGroup.check(when (draft.colorMode) {
                PlayerFlowColorMode.FOLLOW_COVER -> R.id.modeFollow
                PlayerFlowColorMode.SOFT -> R.id.modeSoft
                PlayerFlowColorMode.VIVID -> R.id.modeVivid
            })
            syncing = false
            updatePreview()
        }
        binding.colorModeGroup.setOnCheckedChangeListener { _, checkedId ->
            if (!syncing) {
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
        val observer = object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                if (!closed && binding.backgroundPreview.visibility == View.VISIBLE) preview.onStart()
            }
            override fun onStop(owner: LifecycleOwner) { preview.onStop() }
            override fun onDestroy(owner: LifecycleOwner) { dialog.dismiss() }
        }
        dialog.setOnDismissListener {
            closed = true
            activity.lifecycle.removeObserver(observer)
            preview.release()
        }
        dialog.setOnShowListener {
            val sheet = dialog.findViewById<FrameLayout>(com.google.android.material.R.id.design_bottom_sheet)
                ?: return@setOnShowListener
            val availableHeight = activity.window.decorView.height.takeIf { it > 0 }
                ?: activity.resources.displayMetrics.heightPixels
            val height = (availableHeight * 0.8f).roundToInt()
            val compact = height / activity.resources.displayMetrics.density < 440
            binding.backgroundPreview.visibility = if (compact) View.GONE else View.VISIBLE
            sheet.layoutParams = sheet.layoutParams.apply { this.height = height }
            BottomSheetBehavior.from(sheet).apply {
                maxHeight = height
                skipCollapsed = true
                state = BottomSheetBehavior.STATE_EXPANDED
            }
            if (!compact) preview.onStart() else preview.onStop()
        }
        loadDraft()
        activity.lifecycle.addObserver(observer)
        dialog.show()
        cn.partialy.pm.ui.message.PmMessage.register(dialog)
    }
}
