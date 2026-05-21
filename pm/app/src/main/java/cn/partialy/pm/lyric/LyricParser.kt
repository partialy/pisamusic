package cn.partialy.pm.lyric

enum class LyricFormat {
    NONE,
    LRC,
    KRC,
    YRC,
}

data class LyricWord(
    val startTime: Long,
    val endTime: Long,
    val word: String,
)

data class LyricLine(
    val words: List<LyricWord>,
    val startTime: Long,
    val endTime: Long,
) {
    val lineText: String
        get() = words.joinToString(separator = "") { it.word }

    val hasWordTiming: Boolean
        get() = words.size > 1 || words.any { it.startTime != startTime || it.endTime != endTime }

    companion object {
        fun message(text: String): LyricLine =
            LyricLine(
                words = listOf(LyricWord(0L, DEFAULT_MESSAGE_DURATION_MS, text)),
                startTime = 0L,
                endTime = DEFAULT_MESSAGE_DURATION_MS,
            )

        private const val DEFAULT_MESSAGE_DURATION_MS = 5_000L
    }
}

data class RawLyric(
    val text: String,
    val format: LyricFormat,
    val source: String,
)

data class LyricContent(
    val rawText: String,
    val format: LyricFormat,
    val source: String,
    val lines: List<LyricLine>,
    val placeholderText: String? = null,
) {
    val hasLyrics: Boolean
        get() = placeholderText == null && lines.isNotEmpty()

    val hasWordTiming: Boolean
        get() = hasLyrics && lines.any { it.hasWordTiming }

    val displayLines: List<LyricLine>
        get() = if (lines.isNotEmpty()) lines else listOf(LyricLine.message(placeholderText ?: NO_LYRIC_TEXT))

    companion object {
        const val NO_LYRIC_TEXT = "暂无歌词"
        const val ERROR_TEXT = "error"

        fun noLyrics(): LyricContent =
            LyricContent(
                rawText = "",
                format = LyricFormat.NONE,
                source = "none",
                lines = emptyList(),
                placeholderText = NO_LYRIC_TEXT,
            )

        fun message(text: String): LyricContent =
            LyricContent(
                rawText = "",
                format = LyricFormat.NONE,
                source = "message",
                lines = emptyList(),
                placeholderText = text,
            )
    }
}

data class CurrentLyricLine(
    val index: Int,
    val line: LyricLine,
    val progress: Float,
    val elapsedMs: Long,
    val durationMs: Long,
)

object LyricParser {
    private const val LAST_LINE_FALLBACK_DURATION_MS = 5_000L
    private val timestampRegex = Regex("""^(\d+):(\d+)(?:\.(\d+))?$""")
    private val lrcLineRegex = Regex("""((?:\[\d+:\d+(?:\.\d+)?])+)(.*)$""")
    private val lrcTimeTagRegex = Regex("""\[(\d+:\d+(?:\.\d+)?)\]""")
    private val krcHeaderRegex = Regex("""^\[(\d+),(\d+)\]""")
    private val krcWordRegex = Regex("""<(\d+),(\d+),\d+>([^<]*)""")
    private val yrcHeaderRegex = Regex("""^\[(\d+),(\d+)\]""")
    private val yrcWordRegex = Regex("""\((\d+),(\d+),\d+\)([^(]*)""")

    fun parseContent(raw: RawLyric): LyricContent {
        val text = raw.text.trim()
        if (text.isBlank() || text == LyricContent.ERROR_TEXT || text == LyricContent.NO_LYRIC_TEXT) {
            return LyricContent.noLyrics()
        }
        val lines = parseByFormat(text, raw.format)
        return if (lines.isEmpty()) {
            LyricContent.noLyrics()
        } else {
            LyricContent(
                rawText = text,
                format = raw.format,
                source = raw.source,
                lines = lines,
            )
        }
    }

    fun parseBest(rawText: String, source: String = "unknown"): LyricContent {
        val text = rawText.trim()
        if (text.isBlank() || text == LyricContent.ERROR_TEXT || text == LyricContent.NO_LYRIC_TEXT) {
            return LyricContent.noLyrics()
        }
        val candidates = when {
            source.contains("krc", ignoreCase = true) -> listOf(LyricFormat.KRC, LyricFormat.LRC)
            source.contains("yrc", ignoreCase = true) -> listOf(LyricFormat.YRC, LyricFormat.LRC)
            looksLikeKrc(text) -> listOf(LyricFormat.KRC, LyricFormat.LRC)
            looksLikeYrc(text) -> listOf(LyricFormat.YRC, LyricFormat.LRC)
            else -> listOf(LyricFormat.LRC)
        }
        for (format in candidates) {
            val lines = parseByFormat(text, format)
            if (lines.isNotEmpty()) {
                return LyricContent(text, format, source, lines)
            }
        }
        return LyricContent.noLyrics()
    }

    fun parseLrc(lrc: String): List<LyricLine> {
        data class Entry(val time: Long, val text: String)

        val entries = mutableListOf<Entry>()
        normalizeNewlines(lrc).lineSequence().forEach { raw ->
            val line = raw.trim()
            if (line.isEmpty()) return@forEach
            val match = lrcLineRegex.matchEntire(line) ?: return@forEach
            val lyricText = match.groupValues[2].trim()
            if (lyricText.isEmpty()) return@forEach
            lrcTimeTagRegex.findAll(match.groupValues[1]).forEach { tag ->
                val time = parseTimestamp(tag.groupValues[1])
                if (time >= 0L) entries += Entry(time, lyricText)
            }
        }

        entries.sortBy { it.time }
        return entries.mapIndexed { index, entry ->
            val endTime = entries.getOrNull(index + 1)?.time ?: (entry.time + LAST_LINE_FALLBACK_DURATION_MS)
            LyricLine(
                words = listOf(LyricWord(entry.time, endTime, entry.text)),
                startTime = entry.time,
                endTime = endTime.coerceAtLeast(entry.time + 1L),
            )
        }
    }

    fun parseKrc(krc: String): List<LyricLine> =
        normalizeNewlines(krc)
            .lineSequence()
            .mapNotNull(::parseKrcLine)
            .sortedBy { it.startTime }
            .toList()

    fun parseYrc(yrc: String): List<LyricLine> =
        normalizeNewlines(yrc)
            .lineSequence()
            .mapNotNull(::parseYrcLine)
            .sortedBy { it.startTime }
            .toList()

    fun findCurrentLine(lines: List<LyricLine>, positionMs: Long): CurrentLyricLine? {
        if (lines.isEmpty()) return null
        val safePosition = positionMs.coerceAtLeast(0L)
        var index = 0
        for (i in lines.indices) {
            if (i == lines.lastIndex || safePosition < lines[i + 1].startTime) {
                index = i
                break
            }
        }

        val current = lines[index]
        val duration = (current.endTime - current.startTime).coerceAtLeast(1L)
        val elapsed = (safePosition - current.startTime).coerceIn(0L, duration)
        return CurrentLyricLine(
            index = index,
            line = current,
            progress = (elapsed.toFloat() / duration.toFloat()).coerceIn(0f, 1f),
            elapsedMs = elapsed,
            durationMs = duration,
        )
    }

    private fun parseByFormat(text: String, format: LyricFormat): List<LyricLine> =
        when (format) {
            LyricFormat.KRC -> parseKrc(text)
            LyricFormat.YRC -> parseYrc(text)
            LyricFormat.LRC -> parseLrc(text)
            LyricFormat.NONE -> emptyList()
        }

    private fun parseKrcLine(raw: String): LyricLine? {
        val line = raw.trim()
        if (line.isEmpty()) return null
        val header = krcHeaderRegex.find(line) ?: return null
        val lineStart = header.groupValues[1].toLongOrNull() ?: return null
        val lineDuration = header.groupValues[2].toLongOrNull() ?: return null
        val wordsPart = line.substring(header.value.length)
        val words = krcWordRegex.findAll(wordsPart)
            .mapNotNull { match ->
                val offset = match.groupValues[1].toLongOrNull() ?: return@mapNotNull null
                val duration = match.groupValues[2].toLongOrNull() ?: return@mapNotNull null
                val word = match.groupValues[3]
                if (word.isEmpty()) return@mapNotNull null
                val start = lineStart + offset
                LyricWord(start, start + duration, word)
            }
            .toList()
        if (words.isEmpty()) return null
        return LyricLine(words, lineStart, (lineStart + lineDuration).coerceAtLeast(words.maxOf { it.endTime }))
    }

    private fun parseYrcLine(raw: String): LyricLine? {
        val line = raw.trim()
        if (line.isEmpty()) return null
        val header = yrcHeaderRegex.find(line) ?: return null
        val lineStart = header.groupValues[1].toLongOrNull() ?: return null
        val lineDuration = header.groupValues[2].toLongOrNull() ?: return null
        val wordsPart = line.substring(header.value.length)
        val words = yrcWordRegex.findAll(wordsPart)
            .mapNotNull { match ->
                val start = match.groupValues[1].toLongOrNull() ?: return@mapNotNull null
                val duration = match.groupValues[2].toLongOrNull() ?: return@mapNotNull null
                val word = match.groupValues[3]
                if (word.isEmpty()) return@mapNotNull null
                LyricWord(start, start + duration, word)
            }
            .toList()
        if (words.isEmpty()) return null
        return LyricLine(words, lineStart, (lineStart + lineDuration).coerceAtLeast(words.maxOf { it.endTime }))
    }

    private fun parseTimestamp(ts: String): Long {
        val match = timestampRegex.matchEntire(ts) ?: return -1L
        val minutes = match.groupValues[1].toLongOrNull() ?: return -1L
        val seconds = match.groupValues[2].toLongOrNull() ?: return -1L
        val millis = match.groupValues.getOrNull(3)
            ?.takeIf { it.isNotBlank() }
            ?.padEnd(3, '0')
            ?.take(3)
            ?.toLongOrNull()
            ?: 0L
        return minutes * 60_000L + seconds * 1_000L + millis
    }

    private fun normalizeNewlines(text: String): String =
        text
            .replace("""\\r\\n""", "\n")
            .replace("""\\n""", "\n")
            .replace("\r\n", "\n")

    private fun looksLikeKrc(text: String): Boolean =
        krcHeaderRegex.containsMatchIn(text) && krcWordRegex.containsMatchIn(text)

    private fun looksLikeYrc(text: String): Boolean =
        yrcHeaderRegex.containsMatchIn(text) && yrcWordRegex.containsMatchIn(text)
}
