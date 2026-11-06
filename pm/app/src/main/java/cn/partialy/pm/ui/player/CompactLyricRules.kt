package cn.partialy.pm.ui.player

import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.lyric.LyricWord

/** 所有进度来自媒体时间，因此暂停不漂移、Seek 无需追赶旧动画。 */
object CompactLyricRules {
    fun currentIndex(lines: List<LyricLine>, positionMs: Long): Int =
        lines.indexOfLast { it.startTime <= positionMs }.let { if (it < 0 && lines.isNotEmpty()) 0 else it }

    fun wordProgress(word: LyricWord, positionMs: Long): Float = when {
        positionMs >= word.endTime -> 1f
        positionMs <= word.startTime -> 0f
        else -> (positionMs - word.startTime).toFloat() / (word.endTime - word.startTime).coerceAtLeast(1L)
    }

    fun horizontalOffset(overflowPx: Float, density: Float, elapsedMs: Long, durationMs: Long): Float {
        if (overflowPx <= 0f || elapsedMs <= 350L) return 0f
        val seconds = ((durationMs - 350L).coerceAtLeast(1L) / 1000f)
        val speed = maxOf(30f * density, overflowPx / seconds).coerceAtMost(60f * density)
        return (speed * (elapsedMs - 350L) / 1000f).coerceIn(0f, overflowPx)
    }
}
