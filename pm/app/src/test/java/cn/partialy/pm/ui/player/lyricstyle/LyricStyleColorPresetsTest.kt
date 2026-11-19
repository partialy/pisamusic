package cn.partialy.pm.ui.player.lyricstyle

import cn.partialy.pm.utils.localdata.AppConfigRecord
import cn.partialy.pm.utils.localdata.AppConfigStorage
import cn.partialy.pm.utils.localdata.AppConfigStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LyricStyleColorPresetsTest {

    private class FakeStorage : AppConfigStorage {
        val map = linkedMapOf<String, AppConfigRecord>()
        override fun get(key: String): AppConfigRecord? = map[key]
        override fun put(record: AppConfigRecord) {
            map[record.key] = record
        }
        override fun delete(key: String) {
            map.remove(key)
        }
        override fun listByNamespace(namespace: String): List<AppConfigRecord> =
            map.values.filter { it.namespace == namespace }
    }

    private fun createStores(): Pair<LyricStyleColorPresetsStore, LyricEffectConfigStore> {
        val configStore = AppConfigStore(FakeStorage())
        val effectConfigStore = LyricEffectConfigStore(configStore)
        val presetsStore = LyricStyleColorPresetsStore(configStore, effectConfigStore)
        return presetsStore to effectConfigStore
    }

    @Test
    fun `each style and slot keeps isolated preset list`() {
        val (presetsStore, _) = createStores()
        val bounceUnlit = LyricColorPresetRegistry.findSlot(LyricEffectStyleId.BOUNCE, "unlitColor")!!
        val bounceActive = LyricColorPresetRegistry.findSlot(LyricEffectStyleId.BOUNCE, "activeColor")!!
        val spotlightUnlit = LyricColorPresetRegistry.findSlot(LyricEffectStyleId.SPOTLIGHT, "unlitColor")!!

        val initialSpotlightUnlit = presetsStore.getPresets(spotlightUnlit)
        val initialBounceActive = presetsStore.getPresets(bounceActive)

        val customColor = 0xFF123456.toInt()
        val outcome = presetsStore.addPreset(bounceUnlit, customColor)
        assertEquals(LyricStyleColorPresetsStore.PresetMutationOutcome.Success, outcome)

        assertTrue(presetsStore.getPresets(bounceUnlit).contains(customColor))
        assertEquals(initialBounceActive, presetsStore.getPresets(bounceActive))
        assertEquals(initialSpotlightUnlit, presetsStore.getPresets(spotlightUnlit))
    }

    @Test
    fun `enforces max 12 presets, rejects duplicates, and keeps at least one`() {
        val (presetsStore, _) = createStores()
        val slot = LyricColorPresetRegistry.findSlot(LyricEffectStyleId.TYPEWRITER, "textColor")!!

        // 填充至上限 12 个
        var candidate = 0xFF010101.toInt()
        while (presetsStore.getPresets(slot).size < LyricStyleColorPresetsStore.MAX_PRESET_COUNT) {
            presetsStore.addPreset(slot, candidate)
            candidate += 0x00010203
        }

        // 超出上限返回 LimitReached
        assertEquals(
            LyricStyleColorPresetsStore.PresetMutationOutcome.LimitReached,
            presetsStore.addPreset(slot, 0xFFABCDEF.toInt()),
        )

        // 删除到只剩 1 个后再次删除返回 KeepAtLeastOne
        val current = presetsStore.getPresets(slot)
        for (i in 0 until current.size - 1) {
            assertEquals(
                LyricStyleColorPresetsStore.PresetMutationOutcome.Success,
                presetsStore.removePreset(slot, current[i]),
            )
        }
        assertEquals(1, presetsStore.getPresets(slot).size)
        assertEquals(
            LyricStyleColorPresetsStore.PresetMutationOutcome.KeepAtLeastOne,
            presetsStore.removePreset(slot, presetsStore.getPresets(slot).first()),
        )

        // 重复颜色拒绝添加
        val existing = presetsStore.getPresets(slot).first()
        assertEquals(
            LyricStyleColorPresetsStore.PresetMutationOutcome.AlreadyExists,
            presetsStore.addPreset(slot, existing),
        )
    }

    @Test
    fun `updating or removing active slot color syncs or falls back in effect config`() {
        val (presetsStore, effectStore) = createStores()
        val slot = LyricColorPresetRegistry.findSlot(LyricEffectStyleId.NEON, "colorMid")!!

        val initialColor = slot.readEffectColor!!.invoke(effectStore.read())
        val presets = presetsStore.getPresets(slot)
        val activeIdx = presets.indexOf(initialColor)
        assertTrue(activeIdx >= 0)

        // 修改当前选中的预设颜色，应同步更新 effectConfig 当前选中颜色
        val editedColor = 0xFF44CC88.toInt()
        assertEquals(
            LyricStyleColorPresetsStore.PresetMutationOutcome.Success,
            presetsStore.updatePreset(slot, activeIdx, editedColor),
        )
        assertEquals(editedColor, slot.readEffectColor.invoke(effectStore.read()))

        // 删除当前选中的预设颜色，应自动回落到列表中的第一个颜色
        assertEquals(
            LyricStyleColorPresetsStore.PresetMutationOutcome.Success,
            presetsStore.removePreset(slot, editedColor),
        )
        val remaining = presetsStore.getPresets(slot)
        assertNotEquals(editedColor, slot.readEffectColor.invoke(effectStore.read()))
        assertEquals(remaining.first(), slot.readEffectColor.invoke(effectStore.read()))
    }

    @Test
    fun `resetting style preserves custom color preset lists`() {
        val (presetsStore, effectStore) = createStores()
        val slot = LyricColorPresetRegistry.findSlot(LyricEffectStyleId.INK, "highlightTipColor")!!

        val customColor = 0xFFAA55EE.toInt()
        assertEquals(
            LyricStyleColorPresetsStore.PresetMutationOutcome.Success,
            presetsStore.addPreset(slot, customColor),
        )
        effectStore.update { cfg ->
            slot.writeEffectColor!!.invoke(cfg, customColor)
        }
        assertEquals(customColor, slot.readEffectColor!!.invoke(effectStore.read()))

        // 重置该样式后：当前激活颜色回到默认值，但预设色板保留自定义颜色
        effectStore.resetStyle(LyricEffectStyleId.INK)
        assertEquals(slot.defaultColor, slot.readEffectColor.invoke(effectStore.read()))
        assertTrue(presetsStore.getPresets(slot).contains(customColor))
    }
}
