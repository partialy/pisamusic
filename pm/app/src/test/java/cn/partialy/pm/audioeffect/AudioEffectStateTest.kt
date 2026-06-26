package cn.partialy.pm.audioeffect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AudioEffectStateTest {
    @Test
    fun `normalizes eq gain count and range`() {
        val state = AudioEffectState(
            eqGains = listOf(-30, -12, 0, 8, 30),
            bass = 200,
            vocal = -20,
        ).normalized()

        assertEquals(AudioEffectState.EQ_FREQUENCIES_HZ.size, state.eqGains.size)
        assertEquals(-12, state.eqGains[0])
        assertEquals(12, state.eqGains[4])
        assertTrue(state.eqGains.drop(5).all { it == 0 })
        assertEquals(100, state.bass)
        assertEquals(0, state.vocal)
    }

    @Test
    fun `manual edit marks state as manual preset`() {
        val state = AudioEffectState(selectedPresetId = AudioEffectPreset.ID_3D)
            .copy(eqGains = AudioEffectState.flatEqGains().toMutableList().also { it[2] = 5 })
            .toManual()

        assertEquals(AudioEffectPreset.ID_MANUAL, state.selectedPresetId)
        assertEquals(5, state.eqGains[2])
    }

    @Test
    fun `serializes and restores custom presets`() {
        val custom = AudioEffectPreset(
            id = "custom_test",
            name = "我的音效",
            eqGains = listOf(1, 2, 3),
            bass = 40,
            vocal = 50,
        )
        val state = AudioEffectState(
            selectedPresetId = custom.id,
            customPresets = listOf(custom),
            bass = custom.bass,
            vocal = custom.vocal,
        )

        val restored = AudioEffectsPrefs.decodeState(AudioEffectsPrefs.encodeState(state))

        assertEquals(custom.id, restored.selectedPresetId)
        assertEquals(1, restored.customPresets.size)
        assertEquals(AudioEffectState.EQ_FREQUENCIES_HZ.size, restored.customPresets[0].eqGains.size)
        assertEquals(40, restored.customPresets[0].bass)
        assertEquals(50, restored.customPresets[0].vocal)
    }

    @Test
    fun `custom preset is placed after built ins`() {
        val custom = AudioEffectPreset(
            id = "custom_tail",
            name = "尾部预设",
            eqGains = AudioEffectState.flatEqGains(),
        )
        val state = AudioEffectState(customPresets = listOf(custom))
        val presets = AudioEffectPreset.builtIns() + state.customPresets

        assertEquals(AudioEffectPreset.ID_ROCK, presets[presets.lastIndex - 1].id)
        assertEquals(custom.id, presets.last().id)
    }
}
