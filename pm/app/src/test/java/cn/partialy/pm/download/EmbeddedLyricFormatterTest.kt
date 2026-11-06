package cn.partialy.pm.download

import cn.partialy.pm.lyric.LyricParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EmbeddedLyricFormatterTest {
    private val wordKrc = DownloadLyricAsset(
        "[ti:测试]\n[1000,600]<0,200,0>你<200,400,0>好\n[2100,900]<0,300,0>世<300,600,0>界",
        "krc",
    )

    @Test fun nativeLrcTakesPrecedence() {
        val lrc = DownloadLyricAsset("[00:01.50]原生歌词", "lrc")
        assertEquals(lrc.text, EmbeddedLyricFormatter.standardLrc(lrc, wordKrc))
    }

    @Test fun krcConvertsToStandardLrcWithTiming() {
        val text = EmbeddedLyricFormatter.standardLrc(null, wordKrc)
        assertTrue(text.contains("[00:01.00]你好"))
        assertTrue(text.contains("[00:02.10]世界"))
        assertTrue(LyricParser.parseBest(text).hasLyrics)
    }


    @Test fun embeddedKrcWithLeadingMetadataIsRecognized() {
        val embedded = "[ti:Example]\n[ar:Artist]\n[1000,600]<0,200,0>你<200,400,0>好"
        assertTrue(LyricParser.parseBest(embedded, source = "embedded").hasWordTiming)
    }

    @Test fun invalidLyricsDoNotEmbed() {
        assertEquals("", EmbeddedLyricFormatter.standardLrc(null, DownloadLyricAsset("nonsense", "krc")))
        assertEquals("", EmbeddedLyricFormatter.standardLrc(null, null))
    }
}
