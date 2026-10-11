package cn.partialy.pm.download

import cn.partialy.pm.utils.SettingsPrefs
import org.junit.Assert.assertEquals
import org.junit.Test

class DownloadLyricSelectorTest {
    private val word = DownloadLyricAsset("word", "krc")
    private val line = DownloadLyricAsset("line", "lrc")

    @Test
    fun offDoesNotSelectLyrics() {
        assertEquals(emptyList<DownloadLyricAsset>(), select(SettingsPrefs.DownloadLyricMode.Off))
    }

    @Test
    fun wordPrefersWordLyric() {
        assertEquals(listOf(word), select(SettingsPrefs.DownloadLyricMode.Word))
    }

    @Test
    fun wordFallsBackToLineLyric() {
        assertEquals(
            listOf(line),
            DownloadLyricSelector.select(SettingsPrefs.DownloadLyricMode.Word, null, line),
        )
    }

    @Test
    fun lineOnlySelectsLineLyric() {
        assertEquals(listOf(line), select(SettingsPrefs.DownloadLyricMode.Line))
        assertEquals(
            emptyList<DownloadLyricAsset>(),
            DownloadLyricSelector.select(SettingsPrefs.DownloadLyricMode.Line, word, null),
        )
    }

    @Test
    fun allSelectsBothAvailableLyrics() {
        assertEquals(listOf(word, line), select(SettingsPrefs.DownloadLyricMode.All))
    }

    private fun select(mode: SettingsPrefs.DownloadLyricMode): List<DownloadLyricAsset> =
        DownloadLyricSelector.select(mode, word, line)
}
