package cn.partialy.pm.ui.player.lyricstyle

import cn.partialy.pm.utils.localdata.AppConfigRecord
import cn.partialy.pm.utils.localdata.AppConfigStorage
import cn.partialy.pm.utils.localdata.AppConfigStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class LyricStyleColorPresetsStoreTest {

    private class FakeStorage : AppConfigStorage {
        val map = linkedMapOf<String, AppConfigRecord>()
        override fun get(key: String) = map[key]
        override fun put(record: AppConfigRecord) { map[record.key] = record }
        override fun delete(key: String) { map.remove(key) }
        override fun listByNamespace(namespace: String) = map.values.filter { it.namespace == namespace }
    }

    @Test
    fun decodeNormalizesAlphaAccordingToSlotSpec() {
        val storage = FakeStorage()
        val appStore = AppConfigStore(storage)
        val effectStore = LyricEffectConfigStore(appStore)
        val store = LyricStyleColorPresetsStore(appStore, effectStore)

        val opaqueSpec = LyricColorSlotSpec(
            styleId = LyricEffectStyleId.DEFAULT,
            slotKey = "opaque_test",
            titleRes = 0,
            allowAlpha = false,
            defaultColor = 0xFF112233.toInt(),
            defaultPresets = listOf(0xFF112233.toInt()),
        )
        appStore.write(
            key = opaqueSpec.storageKey(),
            valueJson = "[${0x80123456.toInt()},${0x40ABCDEF.toInt()}]",
            namespace = "lyric_color_presets",
            schemaVersion = 1,
        )
        val decodedOpaque = store.getPresets(opaqueSpec)
        assertEquals(listOf(0xFF123456.toInt(), 0xFFABCDEF.toInt()), decodedOpaque)

        val alphaSpec = LyricColorSlotSpec(
            styleId = LyricEffectStyleId.OCEAN,
            slotKey = "alpha_test",
            titleRes = 0,
            allowAlpha = true,
            defaultColor = 0x80112233.toInt(),
            defaultPresets = listOf(0x80112233.toInt()),
        )
        appStore.write(
            key = alphaSpec.storageKey(),
            valueJson = "[${0x80123456.toInt()}]",
            namespace = "lyric_color_presets",
            schemaVersion = 1,
        )
        assertEquals(listOf(0x80123456.toInt()), store.getPresets(alphaSpec))
    }

    @Test
    fun sharedEffectStorePreservesMotionParamsAndResetsStyleColors() {
        val storage = FakeStorage()
        val appStore = AppConfigStore(storage)
        val effectStore = LyricEffectConfigStore(appStore)
        val presetStore = LyricStyleColorPresetsStore(appStore, effectStore)

        val oceanSlots = LyricColorPresetRegistry.slotsFor(LyricEffectStyleId.OCEAN)
        val primaryOceanSlot = oceanSlots.first()
        val initialPresets = presetStore.getPresets(primaryOceanSlot)
        val editedColor = 0xCC11EE99.toInt()

        effectStore.update { cfg ->
            val updatedOcean = cfg.withStyle(LyricEffectStyleId.OCEAN).copy(
                fps = LyricRenderFps.UNLIMITED,
                ocean = cfg.ocean.copy(
                    jumpHeightDp = 22,
                    swayEnabled = false,
                ),
            )
            primaryOceanSlot.writeEffectColor!!.invoke(updatedOcean, initialPresets.first())
        }

        val updateOutcome = presetStore.updatePreset(primaryOceanSlot, 0, editedColor)
        assertEquals(LyricStyleColorPresetsStore.PresetMutationOutcome.Success, updateOutcome)

        val afterColorEdit = effectStore.read()
        assertEquals(LyricRenderFps.UNLIMITED, afterColorEdit.fps)
        assertEquals(22, afterColorEdit.ocean.jumpHeightDp)
        assertFalse(afterColorEdit.ocean.swayEnabled)
        assertEquals(editedColor, primaryOceanSlot.readEffectColor!!.invoke(afterColorEdit))

        presetStore.resetPresetsForStyle(oceanSlots)

        val afterReset = effectStore.read()
        assertEquals(primaryOceanSlot.defaultPresets, presetStore.getPresets(primaryOceanSlot))
        assertEquals(primaryOceanSlot.defaultColor, primaryOceanSlot.readEffectColor!!.invoke(afterReset))
        assertEquals(22, afterReset.ocean.jumpHeightDp)
        assertFalse(afterReset.ocean.swayEnabled)
    }
}
