package cn.partialy.pm.lyric

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LyricParserTest {
    @Test
    fun parseSupportsTwoAndThreeDigitMillis() {
        val rows = LyricParser.parse(
            """
            [00:01.23]第一句
            [00:02.345]第二句
            """.trimIndent(),
        )

        assertEquals(2, rows.size)
        assertEquals(1_230L, rows[0].timeMs)
        assertEquals("第一句", rows[0].text)
        assertEquals(2_345L, rows[1].timeMs)
        assertEquals("第二句", rows[1].text)
    }

    @Test
    fun parseFallsBackToPlainTextWhenNoValidTimeTags() {
        val rows = LyricParser.parse("这是一段纯文本歌词")

        assertEquals(listOf(LyricLine(0L, "这是一段纯文本歌词")), rows)
    }

    @Test
    fun parseFiltersInvalidAndEmptyTimedLines() {
        val rows = LyricParser.parse(
            """
            [xx:yy.zz]坏行
            [00:03.00]
            [00:04.00]有效行
            """.trimIndent(),
        )

        assertEquals(listOf(LyricLine(4_000L, "有效行")), rows)
    }

    @Test
    fun findCurrentLineHandlesBeforeFirstBetweenAndLastLine() {
        val rows = listOf(
            LyricLine(1_000L, "第一句"),
            LyricLine(3_000L, "第二句"),
            LyricLine(5_000L, "第三句"),
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
            LyricLine(1_000L, "第一句"),
            LyricLine(1_000L, "第二句"),
        )

        val current = LyricParser.findCurrentLine(rows, 10_000L)
        assertEquals(1, current?.index)
        assertEquals(1f, current?.progress ?: -1f, 0.0001f)
    }
}
