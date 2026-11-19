package cn.partialy.pm.ui.player.lyricstyle

import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.lyric.LyricWord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LyricEffectMathTest {

    @Test
    fun frameRateLimiterSupports60Fps30FpsAndUnlimited() {
        val limiter = LyricFrameRateLimiter(60)
        assertTrue(limiter.shouldDraw(0.0))
        assertFalse(limiter.shouldDraw(8.0))
        assertTrue(limiter.shouldDraw(16.0))

        limiter.setTargetFps(30)
        assertTrue(limiter.shouldDraw(100.0))
        assertFalse(limiter.shouldDraw(120.0))
        assertTrue(limiter.shouldDraw(133.4))

        limiter.setTargetFps(LyricRenderFps.UNLIMITED)
        assertTrue(limiter.shouldDraw(200.0))
        assertTrue(limiter.shouldDraw(201.0))
        assertTrue(limiter.shouldDraw(202.0))
    }

    @Test
    fun oceanWaveHeightPeaksAtCenterAndHalvesAtImmediateNeighbors() {
        assertEquals(1.0f, OceanWaveLyricRenderer.waveHeight(0f), 0.0001f)
        assertEquals(0.5f, OceanWaveLyricRenderer.waveHeight(-1f), 0.0001f)
        assertEquals(0.5f, OceanWaveLyricRenderer.waveHeight(1f), 0.0001f)
        assertEquals(0.0f, OceanWaveLyricRenderer.waveHeight(-2f), 0.0001f)
        assertEquals(0.0f, OceanWaveLyricRenderer.waveHeight(2f), 0.0001f)
        assertEquals(0.0f, OceanWaveLyricRenderer.waveHeight(3.5f), 0.0001f)
    }

    @Test
    fun oceanWaveCentersOnFourthCharAtItsMidpoint() {
        val glyphs = (0 until 9).map { idx ->
            EffectGlyph(
                text = (idx + 1).toString(),
                x = idx * 20f,
                baselineY = 100f,
                width = 20f,
                logicalX = idx * 20f,
                startTimeMs = 1_000L + idx * 400L,
                endTimeMs = 1_400L + idx * 400L,
                rowIndex = 0,
            )
        }
        // 第 4 个字（index = 3，文本 "4"）起止 2200..2600，中点 2400
        val state = OceanWaveLyricRenderer.computeWaveState(
            glyphs = glyphs,
            positionMs = 2_400L,
            elapsedMs = 1_400L,
            wordMode = true,
        )
        assertEquals(3.0f, state.waveIndex, 0.001f)
        assertEquals(0.0f, OceanWaveLyricRenderer.waveHeight(1 - state.waveIndex), 0.001f)
        assertEquals(0.5f, OceanWaveLyricRenderer.waveHeight(2 - state.waveIndex), 0.001f)
        assertEquals(1.0f, OceanWaveLyricRenderer.waveHeight(3 - state.waveIndex), 0.001f)
        assertEquals(0.5f, OceanWaveLyricRenderer.waveHeight(4 - state.waveIndex), 0.001f)
        assertEquals(0.0f, OceanWaveLyricRenderer.waveHeight(5 - state.waveIndex), 0.001f)
    }

    @Test
    fun graphemeTimingInterpolatesAcrossMultiCharWords() {
        val line = LyricLine(
            words = listOf(
                LyricWord(1_000L, 1_400L, "Pisa"),
                LyricWord(1_400L, 1_800L, "音乐"),
            ),
            startTime = 1_000L,
            endTime = 1_800L,
        )
        val timings = KaraokeLyricLayoutEngine.buildCharTimings(line, "Pisa音乐".length, 1_800L)
        assertEquals(6, timings.size)
        assertEquals(1_000L, timings[0].startMs)
        assertEquals(1_100L, timings[0].endMs)
        assertEquals(1_300L, timings[3].startMs)
        assertEquals(1_400L, timings[3].endMs)
        assertEquals(1_400L, timings[4].startMs)
        assertEquals(1_600L, timings[4].endMs)
        assertEquals(1_600L, timings[5].startMs)
        assertEquals(1_800L, timings[5].endMs)
    }
}
