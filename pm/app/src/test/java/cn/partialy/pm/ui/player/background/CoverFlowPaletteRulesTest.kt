package cn.partialy.pm.ui.player.background

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CoverFlowPaletteRulesTest {
    @Test
    fun `fallback always supplies four distinct blob colors`() {
        val palette = CoverFlowPaletteRules.fromCandidates(emptyList())

        assertEquals(4, palette.blobColors.size)
        assertEquals(4, palette.blobColors.distinct().size)
    }

    @Test
    fun `single cover color is expanded into a complete palette`() {
        val palette = CoverFlowPaletteRules.fromCandidates(listOf(0xFF4A78C2.toInt()))

        assertEquals(4, palette.blobColors.size)
        assertTrue(CoverFlowPaletteRules.relativeLuminance(palette.baseColor) <= 0.18)
    }

    @Test
    fun `near duplicate candidates do not occupy separate blob slots`() {
        val palette = CoverFlowPaletteRules.fromCandidates(
            listOf(0xFF3F7AC8.toInt(), 0xFF407BC9.toInt(), 0xFFD46A91.toInt()),
        )

        assertEquals(4, palette.blobColors.size)
        assertTrue(CoverFlowPaletteRules.colorDistance(palette.blobColors[0], palette.blobColors[1]) >= 0.08)
    }
}
