package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.audioeffect.AudioEffectPreset
import cn.partialy.pm.audioeffect.AudioEffectState
import cn.partialy.pm.audioeffect.AudioEffectsManager
import cn.partialy.pm.databinding.ActivityAudioEffectsBinding
import cn.partialy.pm.ui.dialog.PmSlotDialog
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.launch

@AndroidEntryPoint
class AudioEffectsActivity : BaseActivity() {
    @Inject lateinit var audioEffectsManager: AudioEffectsManager

    private lateinit var binding: ActivityAudioEffectsBinding
    private val eqRows = mutableListOf<EqControlRow>()
    private var rendering = false
    private var advancedSpatialExpanded = false

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityAudioEffectsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowTitleEnabled(false)
        binding.toolbar.title = getString(R.string.audio_effects_title)
        binding.toolbar.setNavigationOnClickListener { finish() }

        setupEqRows()
        setupListeners()
        observeState()
    }

    private fun setupListeners() {
        binding.audioEffectEnabledSwitch.setOnCheckedChangeListener { _, checked ->
            if (!rendering) audioEffectsManager.setEnabled(checked)
        }

        binding.bassSeekBar.setOnSeekBarChangeListener(simpleSeekListener { value ->
            audioEffectsManager.updateBass(value)
        })
        binding.vocalSeekBar.setOnSeekBarChangeListener(simpleSeekListener { value ->
            audioEffectsManager.updateVocal(value)
        })
        binding.stereoWidthSeekBar.setOnSeekBarChangeListener(simpleSeekListener { value ->
            audioEffectsManager.updateStereoWidth(value + AudioEffectState.STEREO_WIDTH_MIN)
        })
        binding.centerRetentionSeekBar.setOnSeekBarChangeListener(simpleSeekListener { value ->
            audioEffectsManager.updateCenterRetention(value + AudioEffectState.CENTER_RETENTION_MIN)
        })
        binding.spatialDelaySeekBar.setOnSeekBarChangeListener(simpleSeekListener { value ->
            audioEffectsManager.updateSpatialDelayUs(value)
        })
        binding.bassMonoProtectSeekBar.setOnSeekBarChangeListener(simpleSeekListener { value ->
            audioEffectsManager.updateBassMonoProtectHz(
                AudioEffectState.BASS_MONO_PROTECT_OPTIONS_HZ.getOrElse(value) {
                    AudioEffectState.BASS_MONO_PROTECT_DEFAULT_HZ
                },
            )
        })
        binding.advancedSpatialHeader.setOnClickListener {
            advancedSpatialExpanded = !advancedSpatialExpanded
            renderAdvancedSpatialVisibility()
        }

        binding.savePresetButton.setOnClickListener { showSavePresetDialog() }
    }

    private fun setupEqRows() {
        binding.eqControlsContainer.removeAllViews()
        AudioEffectState.EQ_FREQUENCIES_HZ.forEachIndexed { index, frequency ->
            val row = createEqRow(index, frequency)
            eqRows += row
            binding.eqControlsContainer.addView(row.root)
        }
    }

    private fun createEqRow(index: Int, frequency: Int): EqControlRow {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = dp(44)
            setPadding(0, dp(4), 0, dp(4))
        }
        val label = TextView(this).apply {
            text = formatFrequency(frequency)
            setTextColor(ContextCompat.getColor(this@AudioEffectsActivity, R.color.text_secondary))
            textSize = 13f
            gravity = Gravity.CENTER_VERTICAL
            typeface = Typeface.DEFAULT_BOLD
        }
        root.addView(label, LinearLayout.LayoutParams(dp(48), LinearLayout.LayoutParams.WRAP_CONTENT))

        val seekBar = SeekBar(this).apply {
            max = AudioEffectState.EQ_MAX_DB - AudioEffectState.EQ_MIN_DB
            progress = -AudioEffectState.EQ_MIN_DB
            progressDrawable = ContextCompat.getDrawable(this@AudioEffectsActivity, R.drawable.bg_lyric_settings_seekbar_progress)
            thumb = ContextCompat.getDrawable(this@AudioEffectsActivity, R.drawable.bg_lyric_settings_seekbar_thumb)
            splitTrack = false
            thumbOffset = dp(6)
            setOnSeekBarChangeListener(simpleSeekListener { progress ->
                val gain = progress + AudioEffectState.EQ_MIN_DB
                audioEffectsManager.updateEqGain(index, gain)
            })
        }
        root.addView(seekBar, LinearLayout.LayoutParams(0, dp(36), 1f))

        val value = TextView(this).apply {
            text = formatDb(0)
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            setTextColor(ContextCompat.getColor(this@AudioEffectsActivity, R.color.blue_selected))
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
        }
        root.addView(value, LinearLayout.LayoutParams(dp(54), LinearLayout.LayoutParams.WRAP_CONTENT))
        return EqControlRow(root, seekBar, value)
    }

    private fun observeState() {
        lifecycleScope.launch {
            audioEffectsManager.state.collect { renderState(it) }
        }
    }

    private fun renderState(state: AudioEffectState) {
        rendering = true
        binding.audioEffectEnabledSwitch.isChecked = state.enabled
        renderPresetRow(state)
        renderEqRows(state)
        renderStrengthControls(state)
        renderSpatialControls(state)
        renderAdvancedSpatialVisibility()
        rendering = false
    }

    private fun renderPresetRow(state: AudioEffectState) {
        binding.presetRow.removeAllViews()
        audioEffectsManager.availablePresets(state).forEach { preset ->
            val chip = TextView(this).apply {
                text = preset.name
                gravity = Gravity.CENTER
                minWidth = dp(72)
                minHeight = dp(36)
                setPadding(dp(14), 0, dp(14), 0)
                textSize = 14f
                setTextColor(
                    ContextCompat.getColor(
                        this@AudioEffectsActivity,
                        if (preset.id == state.selectedPresetId) R.color.white else R.color.text_secondary,
                    ),
                )
                setBackgroundResource(
                    if (preset.id == state.selectedPresetId) {
                        R.drawable.bg_audio_effect_preset_selected
                    } else {
                        R.drawable.bg_audio_effect_preset
                    },
                )
                setOnClickListener { audioEffectsManager.selectPreset(preset.id) }
            }
            binding.presetRow.addView(
                chip,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    dp(36),
                ).apply { marginEnd = dp(8) },
            )
        }

        val addButton = TextView(this).apply {
            text = "+"
            gravity = Gravity.CENTER
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            contentDescription = getString(R.string.audio_effects_add_preset)
            setTextColor(ContextCompat.getColor(this@AudioEffectsActivity, R.color.blue_selected))
            setBackgroundResource(R.drawable.bg_audio_effect_preset)
            setOnClickListener { AudioEffectPresetEditActivity.start(this@AudioEffectsActivity) }
        }
        binding.presetRow.addView(addButton, LinearLayout.LayoutParams(dp(44), dp(36)))

        binding.savePresetButton.visibility =
            if (state.selectedPresetId == AudioEffectPreset.ID_MANUAL) View.VISIBLE else View.GONE
    }

    private fun showSavePresetDialog() {
        val currentState = audioEffectsManager.state.value
        PmSlotDialog.Builder(this)
            .setContentLayout(R.layout.dialog_save_audio_preset) { view, _ ->
                view.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.presetNameInput)
                    .requestFocus()
            }
            .setCancelButton(getString(R.string.cancel))
            .setConfirmButton(
                text = getString(R.string.listen_together_confirm),
                dismissOnConfirm = false,
            ) { dialog ->
                val input = dialog.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.presetNameInput)
                    ?: return@setConfirmButton
                val name = input.text?.toString()?.trim().orEmpty()
                if (name.isBlank()) {
                    showMessage(getString(R.string.audio_effects_save_preset_name_required))
                    return@setConfirmButton
                }
                if (currentState.customPresets.any { it.name.equals(name, ignoreCase = true) }) {
                    showMessage(getString(R.string.audio_effects_save_preset_name_duplicate))
                    return@setConfirmButton
                }
                audioEffectsManager.addCustomPreset(
                    name = name,
                    eqGains = currentState.eqGains,
                    bass = currentState.bass,
                    vocal = currentState.vocal,
                    stereoWidth = currentState.stereoWidth,
                    centerRetention = currentState.centerRetention,
                    spatialDelayUs = currentState.spatialDelayUs,
                    bassMonoProtectHz = currentState.bassMonoProtectHz,
                )
                dialog.dismiss()
            }
            .show()
    }

    private fun renderEqRows(state: AudioEffectState) {
        val gains = AudioEffectState.normalizeEqGains(state.eqGains)
        eqRows.forEachIndexed { index, row ->
            val gain = gains[index]
            row.seekBar.progress = gain - AudioEffectState.EQ_MIN_DB
            row.valueText.text = formatDb(gain)
        }
    }

    private fun renderStrengthControls(state: AudioEffectState) {
        binding.bassSeekBar.progress = state.bass
        binding.bassValueText.text = getString(R.string.common_percent_value, state.bass)
        binding.vocalSeekBar.progress = state.vocal
        binding.vocalValueText.text = getString(R.string.common_percent_value, state.vocal)
    }

    private fun renderSpatialControls(state: AudioEffectState) {
        binding.stereoWidthSeekBar.progress = state.stereoWidth - AudioEffectState.STEREO_WIDTH_MIN
        binding.stereoWidthValueText.text = getString(R.string.common_percent_value, state.stereoWidth)
        binding.centerRetentionSeekBar.progress = state.centerRetention - AudioEffectState.CENTER_RETENTION_MIN
        binding.centerRetentionValueText.text = getString(R.string.common_percent_value, state.centerRetention)
        binding.spatialDelaySeekBar.progress = state.spatialDelayUs
        binding.spatialDelayValueText.text = getString(R.string.common_microseconds_value, state.spatialDelayUs)
        val protectIndex = AudioEffectState.BASS_MONO_PROTECT_OPTIONS_HZ.indexOf(state.bassMonoProtectHz)
            .coerceAtLeast(0)
        binding.bassMonoProtectSeekBar.progress = protectIndex
        binding.bassMonoProtectValueText.text = formatBassProtect(this, state.bassMonoProtectHz)
    }

    private fun renderAdvancedSpatialVisibility() {
        binding.advancedSpatialContainer.visibility =
            if (advancedSpatialExpanded) View.VISIBLE else View.GONE
        binding.advancedSpatialToggleText.setText(
            if (advancedSpatialExpanded) R.string.audio_effects_collapse else R.string.audio_effects_expand,
        )
    }

    private fun simpleSeekListener(onChanged: (Int) -> Unit): SeekBar.OnSeekBarChangeListener =
        object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser && !rendering) onChanged(progress)
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private data class EqControlRow(
        val root: View,
        val seekBar: SeekBar,
        val valueText: TextView,
    )

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, AudioEffectsActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}

private fun formatFrequency(frequency: Int): String =
    if (frequency >= 1000) "${frequency / 1000}k" else frequency.toString()

private fun formatDb(value: Int): String =
    if (value > 0) "+${value}dB" else "${value}dB"

private fun formatBassProtect(context: Context, value: Int): String =
    if (value <= 0) {
        context.getString(R.string.audio_effect_value_off)
    } else {
        context.getString(R.string.audio_effect_value_hz, value)
    }
