package cn.partialy.pm.audioeffect

import android.content.Context
import android.media.audiofx.BassBoost
import android.media.audiofx.DynamicsProcessing
import android.media.audiofx.Equalizer
import android.media.audiofx.Virtualizer
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.abs

@Singleton
class AudioEffectsManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val _state = MutableStateFlow(AudioEffectsPrefs.readState(context))
    val state: StateFlow<AudioEffectState> = _state.asStateFlow()

    private var audioSessionId: Int = 0
    private var dynamicsProcessing: DynamicsProcessing? = null
    private var equalizer: Equalizer? = null
    private var bassBoost: BassBoost? = null
    private var virtualizer: Virtualizer? = null

    fun bindAudioSession(sessionId: Int) {
        if (sessionId <= 0 || sessionId == audioSessionId) return
        releaseEffects()
        audioSessionId = sessionId
        applyCurrentState()
    }

    fun setEnabled(enabled: Boolean) {
        updateState(_state.value.copy(enabled = enabled))
    }

    fun selectPreset(presetId: String) {
        val current = _state.value
        val preset = availablePresets(current).firstOrNull { it.id == presetId } ?: return
        updateState(
            current.copy(
                selectedPresetId = preset.id,
                eqGains = preset.eqGains,
                bass = preset.bass,
                vocal = preset.vocal,
            ),
        )
    }

    fun updateEqGain(index: Int, gainDb: Int) {
        val current = _state.value
        if (index !in AudioEffectState.EQ_FREQUENCIES_HZ.indices) return
        val nextGains = current.eqGains.toMutableList()
        nextGains[index] = gainDb.coerceIn(AudioEffectState.EQ_MIN_DB, AudioEffectState.EQ_MAX_DB)
        updateState(current.copy(eqGains = nextGains).toManual())
    }

    fun updateBass(value: Int) {
        val current = _state.value
        updateState(current.copy(bass = value).toManual())
    }

    fun updateVocal(value: Int) {
        val current = _state.value
        updateState(current.copy(vocal = value).toManual())
    }

    fun addCustomPreset(name: String, eqGains: List<Int>, bass: Int, vocal: Int): AudioEffectPreset {
        val preset = AudioEffectPreset(
            id = "custom_${System.currentTimeMillis()}",
            name = name.trim().ifBlank { "自定义音效" },
            eqGains = eqGains,
            bass = bass,
            vocal = vocal,
        ).normalized()
        val current = _state.value
        updateState(
            current.copy(
                selectedPresetId = preset.id,
                eqGains = preset.eqGains,
                bass = preset.bass,
                vocal = preset.vocal,
                customPresets = current.customPresets + preset,
            ),
        )
        return preset
    }

    fun availablePresets(): List<AudioEffectPreset> = availablePresets(_state.value)

    fun availablePresets(state: AudioEffectState): List<AudioEffectPreset> {
        val presets = AudioEffectPreset.builtIns() + state.customPresets.map { it.normalized() }
        return if (state.selectedPresetId == AudioEffectPreset.ID_MANUAL) {
            presets + AudioEffectPreset.manualFrom(state)
        } else {
            presets
        }
    }

    fun release() {
        releaseEffects()
        audioSessionId = 0
    }

    private fun updateState(next: AudioEffectState) {
        val normalized = next.normalized()
        _state.value = normalized
        AudioEffectsPrefs.saveState(context, normalized)
        applyCurrentState()
    }

    private fun applyCurrentState() {
        val current = _state.value.normalized()
        if (!current.enabled || audioSessionId <= 0) {
            releaseEffects()
            return
        }

        val effectiveEq = effectiveEqGains(current)
        if (!applyDynamicsProcessing(effectiveEq)) {
            applyEqualizer(effectiveEq)
        } else {
            releaseEqualizer()
        }
        applyBassBoost(current.bass)
        applyVirtualizer(current.selectedPresetId == AudioEffectPreset.ID_3D)
    }

    private fun applyDynamicsProcessing(gains: List<Float>): Boolean =
        runCatching {
            val effect = dynamicsProcessing ?: createDynamicsProcessing().also {
                dynamicsProcessing = it
            }
            gains.forEachIndexed { index, gain ->
                effect.setPreEqBandAllChannelsTo(
                    index,
                    DynamicsProcessing.EqBand(
                        true,
                        AudioEffectState.EQ_FREQUENCIES_HZ[index].toFloat(),
                        gain,
                    ),
                )
            }
            effect.enabled = true
            true
        }.getOrDefault(false)

    private fun createDynamicsProcessing(): DynamicsProcessing {
        val eq = DynamicsProcessing.Eq(true, true, AudioEffectState.EQ_FREQUENCIES_HZ.size)
        AudioEffectState.EQ_FREQUENCIES_HZ.forEachIndexed { index, frequency ->
            eq.setBand(index, DynamicsProcessing.EqBand(true, frequency.toFloat(), 0f))
        }
        val config = DynamicsProcessing.Config.Builder(
            DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
            CHANNEL_COUNT_STEREO,
            true,
            AudioEffectState.EQ_FREQUENCIES_HZ.size,
            false,
            0,
            false,
            0,
            false,
        )
            .setPreEqAllChannelsTo(eq)
            .build()
        return DynamicsProcessing(0, audioSessionId, config)
    }

    private fun applyEqualizer(gains: List<Float>) {
        runCatching {
            val effect = equalizer ?: Equalizer(0, audioSessionId).also { equalizer = it }
            val range = effect.bandLevelRange
            val minLevel = range.getOrNull(0) ?: -1200
            val maxLevel = range.getOrNull(1) ?: 1200
            for (band in 0 until effect.numberOfBands) {
                val bandIndex = band.toShort()
                val centerHz = effect.getCenterFreq(bandIndex) / 1000
                val targetIndex = nearestFrequencyIndex(centerHz)
                val milliBel = (gains[targetIndex] * 100).toInt().coerceIn(minLevel.toInt(), maxLevel.toInt())
                effect.setBandLevel(bandIndex, milliBel.toShort())
            }
            effect.enabled = true
        }
    }

    private fun applyBassBoost(strength: Int) {
        runCatching {
            val effect = bassBoost ?: BassBoost(0, audioSessionId).also { bassBoost = it }
            val safeStrength = (strength.coerceIn(0, 100) * 10).toShort()
            effect.setStrength(safeStrength)
            effect.enabled = strength > 0
        }
    }

    private fun applyVirtualizer(enabled: Boolean) {
        runCatching {
            val effect = virtualizer ?: Virtualizer(0, audioSessionId).also { virtualizer = it }
            effect.setStrength(if (enabled) 650.toShort() else 0.toShort())
            effect.enabled = enabled
        }
    }

    private fun effectiveEqGains(state: AudioEffectState): List<Float> {
        val raw = AudioEffectState.normalizeEqGains(state.eqGains).map { it.toFloat() }.toMutableList()
        val ratio = state.vocal.coerceIn(0, 100) / 100f
        val adjustments = mapOf(
            3 to -1.5f,
            4 to -1.0f,
            5 to 4.0f,
            6 to 6.0f,
            7 to 4.0f,
        )
        adjustments.forEach { (index, boost) ->
            raw[index] = (raw[index] + boost * ratio)
                .coerceIn(AudioEffectState.EQ_MIN_DB.toFloat(), AudioEffectState.EQ_MAX_DB.toFloat())
        }
        return raw
    }

    private fun nearestFrequencyIndex(centerHz: Int): Int =
        AudioEffectState.EQ_FREQUENCIES_HZ.indices.minBy { index ->
            abs(AudioEffectState.EQ_FREQUENCIES_HZ[index] - centerHz)
        }

    private fun releaseEffects() {
        runCatching { dynamicsProcessing?.release() }
        runCatching { equalizer?.release() }
        runCatching { bassBoost?.release() }
        runCatching { virtualizer?.release() }
        dynamicsProcessing = null
        equalizer = null
        bassBoost = null
        virtualizer = null
    }

    private fun releaseEqualizer() {
        runCatching { equalizer?.release() }
        equalizer = null
    }

    private companion object {
        private const val CHANNEL_COUNT_STEREO = 2
    }
}
