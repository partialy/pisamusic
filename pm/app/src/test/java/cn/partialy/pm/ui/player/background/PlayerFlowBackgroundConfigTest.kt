package cn.partialy.pm.ui.player.background

import org.junit.Assert.*
import org.junit.Test

class PlayerFlowBackgroundConfigTest {
    @Test fun `normalization clamps bounds and rounds steps`() {
        val config = PlayerFlowBackgroundConfig(-10, 103, -5, 53, 99).normalized()
        assertEquals(PlayerFlowBackgroundConfig(5, 100, 0, 55, 100), config)
        assertEquals(config, config.normalized())
        assertTrue(PlayerFlowBackgroundConfig().isDefault)
    }
    @Test fun `palette interpolation keeps exact endpoints and dark base`() {
        assertEquals(0xFF123456.toInt(), CoverFlowPaletteRules.interpolateColor(0xFF123456.toInt(), -1, 0f))
        assertEquals(-1, CoverFlowPaletteRules.interpolateColor(0, -1, 1f))
        val white = CoverFlowPaletteRules.fromCandidates(listOf(-1))
        val configured = CoverFlowPaletteRules.applyConfig(white, PlayerFlowBackgroundConfig(brightnessPercent = 100))
        assertTrue(CoverFlowPaletteRules.relativeLuminance(configured.baseColor) < 0.05)
        assertEquals(CoverFlowPaletteRules.fromCandidates(emptyList()), CoverFlowPaletteRules.fromCandidates(listOf(0x00123456)))
    }
}
