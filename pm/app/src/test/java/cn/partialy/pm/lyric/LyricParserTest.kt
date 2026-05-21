package cn.partialy.pm.lyric

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LyricParserTest {
    @Test
    fun parseLrcSupportsTwoAndThreeDigitMillis() {
        val rows = LyricParser.parseLrc(
            """
            [00:01.23]第一句
            [00:02.345]第二句
            """.trimIndent(),
        )

        assertEquals(2, rows.size)
        assertEquals(1_230L, rows[0].startTime)
        assertEquals(2_345L, rows[0].endTime)
        assertEquals("第一句", rows[0].lineText)
        assertEquals(2_345L, rows[1].startTime)
        assertEquals("第二句", rows[1].lineText)
    }

    @Test
    fun parseLrcFiltersInvalidAndEmptyTimedLines() {
        val rows = LyricParser.parseLrc(
            """
            [xx:yy.zz]坏行
            [00:03.00]
            [00:04.00]有效行
            """.trimIndent(),
        )

        assertEquals(1, rows.size)
        assertEquals(4_000L, rows[0].startTime)
        assertEquals("有效行", rows[0].lineText)
    }

    @Test
    fun parseKrcBuildsWordTiming() {
        val rows = LyricParser.parseKrc("[19340,3650]<0,500,0>今<500,600,0>天<1100,800,0>我")

        assertEquals(1, rows.size)
        assertEquals(19_340L, rows[0].startTime)
        assertEquals(22_990L, rows[0].endTime)
        assertEquals("今天我", rows[0].lineText)
        assertTrue(rows[0].hasWordTiming)
        assertEquals(19_840L, rows[0].words[1].startTime)
    }

    @Test
    fun parseYrcBuildsAbsoluteWordTiming() {
        val rows = LyricParser.parseYrc("[19340,3650](19340,500,0)今(19840,600,0)天(20440,800,0)我")

        assertEquals(1, rows.size)
        assertEquals("今天我", rows[0].lineText)
        assertTrue(rows[0].hasWordTiming)
        assertEquals(19_840L, rows[0].words[1].startTime)
        assertEquals(20_440L, rows[0].words[1].endTime)
    }

    @Test
    fun parseContentReturnsNoLyricsForEmptyOrInvalidText() {
        val empty = LyricParser.parseContent(RawLyric("", LyricFormat.LRC, "test"))
        val invalid = LyricParser.parseBest("这是一段纯文本歌词")

        assertFalse(empty.hasLyrics)
        assertEquals("暂无歌词", empty.displayLines.first().lineText)
        assertFalse(invalid.hasLyrics)
    }

    @Test
    fun findCurrentLineHandlesBeforeFirstBetweenAndLastLine() {
        val rows = listOf(
            line(1_000L, 3_000L, "第一句"),
            line(3_000L, 5_000L, "第二句"),
            line(5_000L, 10_000L, "第三句"),
        )

        val before = LyricParser.findCurrentLine(rows, 0L)
        assertEquals(0, before?.index)
        assertEquals(0f, before?.progress ?: -1f, 0.0001f)

        val middle = LyricParser.findCurrentLine(rows, 4_000L)
        assertEquals(1, middle?.index)
        assertEquals(0.5f, middle?.progress ?: -1f, 0.0001f)
        assertEquals(1_000L, middle?.elapsedMs)
        assertEquals(2_000L, middle?.durationMs)

        val last = LyricParser.findCurrentLine(rows, 8_000L)
        assertEquals(2, last?.index)
        assertEquals(0.6f, last?.progress ?: -1f, 0.0001f)
        assertEquals(3_000L, last?.elapsedMs)
        assertEquals(5_000L, last?.durationMs)
    }

    @Test
    fun findCurrentLineClampsProgressAndReturnsNullForEmptyRows() {
        assertNull(LyricParser.findCurrentLine(emptyList(), 1_000L))

        val rows = listOf(
            line(1_000L, 1_001L, "第一句"),
            line(1_000L, 1_001L, "第二句"),
        )

        val current = LyricParser.findCurrentLine(rows, 10_000L)
        assertEquals(1, current?.index)
        assertEquals(1f, current?.progress ?: -1f, 0.0001f)
    }

    private fun line(start: Long, end: Long, text: String): LyricLine =
        LyricLine(listOf(LyricWord(start, end, text)), start, end)
}
