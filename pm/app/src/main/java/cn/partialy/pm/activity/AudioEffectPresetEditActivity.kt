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
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.audioeffect.AudioEffectState
import cn.partialy.pm.audioeffect.AudioEffectsManager
import cn.partialy.pm.databinding.ActivityAudioEffectPresetEditBinding
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class AudioEffectPresetEditActivity : BaseActivity() {
    @Inject lateinit var audioEffectsManager: AudioEffectsManager

    private lateinit var binding: ActivityAudioEffectPresetEditBinding
    private val eqGains = AudioEffectState.flatEqGains().toMutableList()
    private val eqRows = mutableListOf<EqControlRow>()
    private var bass = 0
    private var vocal = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityAudioEffectPresetEditBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowTitleEnabled(false)
        binding.toolbar.title = getString(R.string.audio_effect_preset_edit_title)
        binding.toolbar.setNavigationOnClickListener { finish() }

        setupEqRows()
        setupStrengthControls()
        binding.savePresetButton.setOnClickListener { savePreset() }
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
            setTextColor(ContextCompat.getColor(this@AudioEffectPresetEditActivity, R.color.text_secondary))
            textSize = 13f
            gravity = Gravity.CENTER_VERTICAL
            typeface = Typeface.DEFAULT_BOLD
        }
        root.addView(label, LinearLayout.LayoutParams(dp(48), LinearLayout.LayoutParams.WRAP_CONTENT))

        val valueText = TextView(this).apply {
            text = formatDb(0)
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            setTextColor(ContextCompat.getColor(this@AudioEffectPresetEditActivity, R.color.blue_selected))
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
        }

        val seekBar = SeekBar(this).apply {
            max = AudioEffectState.EQ_MAX_DB - AudioEffectState.EQ_MIN_DB
            progress = -AudioEffectState.EQ_MIN_DB
            progressDrawable = ContextCompat.getDrawable(this@AudioEffectPresetEditActivity, R.drawable.bg_lyric_settings_seekbar_progress)
            thumb = ContextCompat.getDrawable(this@AudioEffectPresetEditActivity, R.drawable.bg_lyric_settings_seekbar_thumb)
            splitTrack = false
            thumbOffset = dp(6)
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    val gain = progress + AudioEffectState.EQ_MIN_DB
                    eqGains[index] = gain
                    valueText.text = formatDb(gain)
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
            })
        }
        root.addView(seekBar, LinearLayout.LayoutParams(0, dp(36), 1f))
        root.addView(valueText, LinearLayout.LayoutParams(dp(54), LinearLayout.LayoutParams.WRAP_CONTENT))
        return EqControlRow(root, seekBar, valueText)
    }

    private fun setupStrengthControls() {
        binding.bassSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                bass = progress
                binding.bassValueText.text = "${progress}%"
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
        binding.vocalSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                vocal = progress
                binding.vocalValueText.text = "${progress}%"
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
    }

    private fun savePreset() {
        audioEffectsManager.addCustomPreset(
            name = binding.presetNameEditText.text?.toString().orEmpty(),
            eqGains = eqGains,
            bass = bass,
            vocal = vocal,
        )
        finish()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private data class EqControlRow(
        val root: View,
        val seekBar: SeekBar,
        val valueText: TextView,
    )

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, AudioEffectPresetEditActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}

private fun formatFrequency(frequency: Int): String =
    if (frequency >= 1000) "${frequency / 1000}k" else frequency.toString()

private fun formatDb(value: Int): String =
    if (value > 0) "+${value}dB" else "${value}dB"
