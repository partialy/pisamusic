package cn.partialy.pm.lyric

data class LyricLine(
    val timeMs: Long,
    val text: String,
)

data class CurrentLyricLine(
    val index: Int,
    val line: LyricLine,
    val progress: Float,
    val elapsedMs: Long,
    val durationMs: Long,
)

object LyricParser {
    private val timeTagPattern = "\\[(\\d{1,2}):(\\d{2})(?:\\.(\\d{1,3}))?]".toRegex()
    private const val LAST_LINE_FALLBACK_DURATION_MS = 5_000L

    fun parse(text: String): List<LyricLine> {
        val rows = mutableListOf<LyricLine>()
        text.lineSequence().forEach { rawLine ->
            val matches = timeTagPattern.findAll(rawLine).toList()
            if (matches.isEmpty()) return@forEach

            val lyricText = rawLine.substring(matches.last().range.last + 1).trim()
            if (lyricText.isEmpty()) return@forEach

            matches.forEach { match ->
                val timeMs = parseTimeTag(match.groupValues)
                if (timeMs >= 0L) rows.add(LyricLine(timeMs, lyricText))
            }
        }

        if (rows.isNotEmpty()) {
            return rows.sortedWith(compareBy<LyricLine> { it.timeMs }.thenBy { it.text })
        }

        val fallback = text.trim()
        return if (fallback.isEmpty()) emptyList() else listOf(LyricLine(0L, fallback))
    }

    fun findCurrentLine(lines: List<LyricLine>, positionMs: Long): CurrentLyricLine? {
        if (lines.isEmpty()) return null
        val safePosition = positionMs.coerceAtLeast(0L)
        var index = 0
        for (i in lines.indices) {
            if (i == lines.lastIndex || safePosition < lines[i + 1].timeMs) {
                index = i
                break
            }
        }

        val current = lines[index]
        val nextTime = lines.getOrNull(index + 1)?.timeMs
        val duration = ((nextTime ?: (current.timeMs + LAST_LINE_FALLBACK_DURATION_MS)) - current.timeMs)
            .coerceAtLeast(1L)
        val elapsed = (safePosition - current.timeMs).coerceIn(0L, duration)
        val progress = (elapsed.toFloat() / duration.toFloat()).coerceIn(0f, 1f)
        return CurrentLyricLine(
            index = index,
            line = current,
            progress = progress,
            elapsedMs = elapsed,
            durationMs = duration,
        )
    }

    private fun parseTimeTag(groups: List<String>): Long {
        val minutes = groups.getOrNull(1)?.toLongOrNull() ?: return -1L
        val seconds = groups.getOrNull(2)?.toLongOrNull() ?: return -1L
        val millis = groups.getOrNull(3)
            ?.takeIf { it.isNotBlank() }
            ?.padEnd(3, '0')
            ?.take(3)
            ?.toLongOrNull()
            ?: 0L
        return minutes * 60_000L + seconds * 1_000L + millis
    }
}
