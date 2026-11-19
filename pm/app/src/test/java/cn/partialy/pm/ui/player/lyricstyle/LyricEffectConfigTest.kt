package cn.partialy.pm.ui.player.lyricstyle

import cn.partialy.pm.utils.localdata.AppConfigRecord
import cn.partialy.pm.utils.localdata.AppConfigStorage
import cn.partialy.pm.utils.localdata.AppConfigStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LyricEffectConfigTest {

    private class FakeStorage : AppConfigStorage {
        val map = linkedMapOf<String, AppConfigRecord>()
        override fun get(key: String) = map[key]
        override fun put(record: AppConfigRecord) { map[record.key] = record }
        override fun delete(key: String) { map.remove(key) }
        override fun listByNamespace(namespace: String) = map.values.filter { it.namespace == namespace }
    }

    @Test
    fun serializationRoundTripAndClampingWorks() {
        val raw = LyricEffectConfig(
            style = "ocean",
            fps = 144,
            typewriter = TypewriterEffectConfig(lineRevealDurationMs = 9999, showCursor = false),
            ink = InkEffectConfig(featherWidthDp = 2, liftOffsetDp = 99f),
            bounce = BounceEffectConfig(jumpHeightDp = 99, jumpScale = 2.5f),
            spotlight = SpotlightEffectConfig(blurIntensityDp = -3f, activeScale = 0.5f),
            neon = NeonEffectConfig(lineRevealDurationMs = 10, flowSpeed = 5f),
            ocean = OceanEffectConfig(jumpHeightDp = 100, showWaveLine = false, swayEnabled = false),
        )
        val encoded = raw.toJson()
        val decoded = LyricEffectConfig.fromJson(encoded)

        assertEquals(LyricEffectStyleId.OCEAN, decoded.styleId)
        assertEquals(LyricRenderFps.DEFAULT, decoded.fps)
        assertEquals(1500, decoded.typewriter.lineRevealDurationMs)
        assertFalse(decoded.typewriter.showCursor)
        assertEquals(6, decoded.ink.featherWidthDp)
        assertEquals(8f, decoded.ink.liftOffsetDp, 0.001f)
        assertEquals(16, decoded.bounce.jumpHeightDp)
        assertEquals(1.3f, decoded.bounce.jumpScale, 0.001f)
        assertEquals(0f, decoded.spotlight.blurIntensityDp, 0.001f)
        assertEquals(1f, decoded.spotlight.activeScale, 0.001f)
        assertEquals(150, decoded.neon.lineRevealDurationMs)
        assertEquals(2f, decoded.neon.flowSpeed, 0.001f)
        assertEquals(24, decoded.ocean.jumpHeightDp)
        assertFalse(decoded.ocean.showWaveLine)
        assertFalse(decoded.ocean.swayEnabled)
    }

    @Test
    fun brokenJsonFallsBackToDefaults() {
        val fallback = LyricEffectConfig.fromJson("{not-valid-json")
        assertEquals(LyricEffectConfig.DEFAULT, fallback)
        assertEquals(13, fallback.ocean.jumpHeightDp)
        assertTrue(fallback.ocean.showWaveLine)
        assertTrue(fallback.ocean.swayEnabled)
    }

    @Test
    fun storePersistsAndResetsSingleStyleOnly() {
        val storage = FakeStorage()
        val repo = LyricEffectConfigStore(AppConfigStore(storage))

        repo.update {
            it.withStyle(LyricEffectStyleId.OCEAN).copy(
                fps = LyricRenderFps.UNLIMITED,
                ocean = it.ocean.copy(jumpHeightDp = 20, swayEnabled = false),
                bounce = it.bounce.copy(jumpHeightDp = 12),
            )
        }

        val reloaded = LyricEffectConfigStore(AppConfigStore(storage)).read()
        assertEquals(LyricEffectStyleId.OCEAN, reloaded.styleId)
        assertEquals(0, reloaded.fps)
        assertEquals(20, reloaded.ocean.jumpHeightDp)
        assertFalse(reloaded.ocean.swayEnabled)
        assertEquals(12, reloaded.bounce.jumpHeightDp)

        val afterReset = repo.resetStyle(LyricEffectStyleId.OCEAN)
        assertEquals(13, afterReset.ocean.jumpHeightDp)
        assertTrue(afterReset.ocean.swayEnabled)
        assertEquals(12, afterReset.bounce.jumpHeightDp)
    }
}
