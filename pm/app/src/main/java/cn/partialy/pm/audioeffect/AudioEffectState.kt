package cn.partialy.pm.audioeffect

import kotlinx.serialization.Serializable

@Serializable
data class AudioEffectState(
    val enabled: Boolean = false,
    val selectedPresetId: String = AudioEffectPreset.ID_DEFAULT,
    val eqGains: List<Int> = flatEqGains(),
    val bass: Int = 0,
    val vocal: Int = 0,
    val customPresets: List<AudioEffectPreset> = emptyList(),
) {
    fun normalized(): AudioEffectState =
        copy(
            eqGains = normalizeEqGains(eqGains),
            bass = bass.coerceIn(EFFECT_MIN, EFFECT_MAX),
            vocal = vocal.coerceIn(EFFECT_MIN, EFFECT_MAX),
            customPresets = customPresets.map { it.normalized() },
        )

    fun toManual(): AudioEffectState =
        copy(selectedPresetId = AudioEffectPreset.ID_MANUAL).normalized()

    companion object {
        const val EQ_MIN_DB = -12
        const val EQ_MAX_DB = 12
        const val EFFECT_MIN = 0
        const val EFFECT_MAX = 100

        val EQ_FREQUENCIES_HZ = listOf(31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000)

        fun flatEqGains(): List<Int> = List(EQ_FREQUENCIES_HZ.size) { 0 }

        fun normalizeEqGains(values: List<Int>): List<Int> =
            List(EQ_FREQUENCIES_HZ.size) { index ->
                values.getOrNull(index)?.coerceIn(EQ_MIN_DB, EQ_MAX_DB) ?: 0
            }
    }
}

@Serializable
data class AudioEffectPreset(
    val id: String,
    val name: String,
    val eqGains: List<Int>,
    val bass: Int = 0,
    val vocal: Int = 0,
    val builtIn: Boolean = false,
) {
    fun normalized(): AudioEffectPreset =
        copy(
            eqGains = AudioEffectState.normalizeEqGains(eqGains),
            bass = bass.coerceIn(AudioEffectState.EFFECT_MIN, AudioEffectState.EFFECT_MAX),
            vocal = vocal.coerceIn(AudioEffectState.EFFECT_MIN, AudioEffectState.EFFECT_MAX),
        )

    companion object {
        const val ID_DEFAULT = "default"
        const val ID_3D = "3d_beauty"
        const val ID_BASS = "bass_boost"
        const val ID_VOCAL = "vocal_boost"
        const val ID_POP = "pop"
        const val ID_ROCK = "rock"
        const val ID_MANUAL = "manual"

        fun builtIns(): List<AudioEffectPreset> = listOf(
            AudioEffectPreset(
                id = ID_DEFAULT,
                name = "默认",
                eqGains = AudioEffectState.flatEqGains(),
                builtIn = true,
            ),
            AudioEffectPreset(
                id = ID_3D,
                name = "3D丽音",
                eqGains = listOf(2, 2, 1, 0, -1, 2, 3, 4, 3, 2),
                bass = 32,
                vocal = 36,
                builtIn = true,
            ),
            AudioEffectPreset(
                id = ID_BASS,
                name = "低音增强",
                eqGains = listOf(5, 5, 4, 2, 0, -1, -1, 0, 1, 1),
                bass = 70,
                builtIn = true,
            ),
            AudioEffectPreset(
                id = ID_VOCAL,
                name = "人声增强",
                eqGains = listOf(-1, -1, 0, 0, 1, 3, 4, 3, 1, 0),
                vocal = 72,
                builtIn = true,
            ),
            AudioEffectPreset(
                id = ID_POP,
                name = "流行",
                eqGains = listOf(2, 3, 2, 0, -1, 1, 2, 3, 3, 2),
                bass = 28,
                vocal = 28,
                builtIn = true,
            ),
            AudioEffectPreset(
                id = ID_ROCK,
                name = "摇滚",
                eqGains = listOf(4, 4, 3, 1, -1, 0, 2, 4, 5, 4),
                bass = 45,
                vocal = 20,
                builtIn = true,
            ),
        )

        fun manualFrom(state: AudioEffectState): AudioEffectPreset =
            AudioEffectPreset(
                id = ID_MANUAL,
                name = "手动调节",
                eqGains = state.eqGains,
                bass = state.bass,
                vocal = state.vocal,
                builtIn = true,
            )
    }
}
