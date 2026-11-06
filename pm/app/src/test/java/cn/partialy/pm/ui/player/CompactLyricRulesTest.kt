package cn.partialy.pm.ui.player

import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.lyric.LyricWord
import org.junit.Assert.*
import org.junit.Test

class CompactLyricRulesTest {
    @Test fun scrollingDelaysCapsAndNeverLoops() {
        assertEquals(0f, CompactLyricRules.horizontalOffset(1000f, 1f, 350, 1000), 0.001f)
        assertEquals(60f, CompactLyricRules.horizontalOffset(1000f, 1f, 1350, 1000), 0.001f)
        assertEquals(100f, CompactLyricRules.horizontalOffset(100f, 1f, 10000, 10000), 0.001f)
        assertEquals(30f, CompactLyricRules.horizontalOffset(100f, 1f, 1350, 10000), 0.001f)
    }

    @Test fun mediaTimeSupportsSeekAndWordBoundaries() {
        val word = LyricWord(1000, 2000, "歌词")
        assertEquals(0f, CompactLyricRules.wordProgress(word, 999), 0f)
        assertEquals(.5f, CompactLyricRules.wordProgress(word, 1500), 0f)
        assertEquals(1f, CompactLyricRules.wordProgress(word, 2000), 0f)
        val lines = listOf(LyricLine(listOf(word), 1000, 2000), LyricLine(listOf(word), 2000, 3000))
        assertEquals(1, CompactLyricRules.currentIndex(lines, 2500))
        assertEquals(0, CompactLyricRules.currentIndex(lines, 1200))
        assertEquals(-1, CompactLyricRules.currentIndex(emptyList(), 0))
    }

    @Test fun directionWaitsForSlopAndLocksUntilReset() {
        val undecided = PlayerSwipeDirectionPolicy.Direction.UNDECIDED
        val horizontal = PlayerSwipeDirectionPolicy.Direction.HORIZONTAL
        val vertical = PlayerSwipeDirectionPolicy.Direction.VERTICAL
        assertEquals(undecided, PlayerSwipeDirectionPolicy.resolve(5f, 0f, 8f))
        assertEquals(undecided, PlayerSwipeDirectionPolicy.resolve(10f, 10f, 8f))
        assertEquals(horizontal, PlayerSwipeDirectionPolicy.resolve(-30f, 10f, 8f))
        assertEquals(vertical, PlayerSwipeDirectionPolicy.resolve(10f, -30f, 8f))
        assertEquals(horizontal, PlayerSwipeDirectionPolicy.resolve(0f, 100f, 8f, horizontal))
    }
}
