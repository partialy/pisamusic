package cn.partialy.pm.ui.player

import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.lyric.LyricWord

/** 仅供设置预览的原创样本，不依赖歌曲、播放器或持久化。 */
internal object LyricPreviewSamples {
    const val DURATION_MS = 8_000L

    val lines: List<LyricLine> = listOf(
        line("旋律随风起", 0L, 2_500L),
        line("心声逐光行", 2_500L, 5_200L),
        line("此刻听星海", 5_200L, DURATION_MS),
    )

    fun positionAt(elapsedMs: Long): Long =
        ((elapsedMs % DURATION_MS) + DURATION_MS) % DURATION_MS

    fun indexAt(positionMs: Long): Int {
        val position = positionAt(positionMs)
        return lines.indexOfLast { position >= it.startTime }.coerceAtLeast(0)
    }

    private fun line(text: String, startMs: Long, endMs: Long): LyricLine {
        val characters = mutableListOf<String>()
        var offset = 0
        while (offset < text.length) {
            val next = offset + Character.charCount(text.codePointAt(offset))
            characters += text.substring(offset, next)
            offset = next
        }
        val duration = endMs - startMs
        return LyricLine(
            words = characters.mapIndexed { index, character ->
                LyricWord(
                    startTime = startMs + duration * index / characters.size,
                    endTime = startMs + duration * (index + 1) / characters.size,
                    word = character,
                )
            },
            startTime = startMs,
            endTime = endMs,
        )
    }
}
