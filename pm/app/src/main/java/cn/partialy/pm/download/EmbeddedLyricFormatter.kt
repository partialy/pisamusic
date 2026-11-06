package cn.partialy.pm.download

import cn.partialy.pm.lyric.LyricFormat
import cn.partialy.pm.lyric.LyricParser
import cn.partialy.pm.lyric.RawLyric
import java.util.Locale

/**
 * ID3 USLT / MP4 / Vorbis 的通用 LYRICS 字段仅存放可移植的逐行 LRC 文本。
 * 原始 KRC/YRC 逐字时间轴必须另存到本地索引，不能在这里有损覆盖。
 */
object EmbeddedLyricFormatter {
    fun standardLrc(line: DownloadLyricAsset?, word: DownloadLyricAsset?): String {
        if (line != null && line.extension.equals("lrc", ignoreCase = true)) {
            val parsed = LyricParser.parseContent(RawLyric(line.text, LyricFormat.LRC, "download_lrc"))
            if (parsed.hasLyrics) return line.text.trim()
        }
        if (word == null) return ""
        val format = when (word.extension.lowercase()) {
            "krc" -> LyricFormat.KRC
            "yrc" -> LyricFormat.YRC
            else -> return ""
        }
        val parsed = LyricParser.parseContent(RawLyric(word.text, format, "download_word"))
        if (!parsed.hasWordTiming) return ""
        val lines = parsed.lines.mapNotNull { lyric ->
            val text = lyric.lineText.trim()
            if (text.isEmpty() || lyric.startTime < 0L) null
            else {
                val totalCentiseconds = lyric.startTime / 10L
                val minutes = totalCentiseconds / 6000L
                val seconds = totalCentiseconds % 6000L / 100L
                val fraction = totalCentiseconds % 100L
                String.format(Locale.US, "[%02d:%02d.%02d]%s", minutes, seconds, fraction, text)
            }
        }
        val result = lines.joinToString("\n")
        return result.takeIf { LyricParser.parseBest(it, "embedded_lrc").hasLyrics }.orEmpty()
    }
}
