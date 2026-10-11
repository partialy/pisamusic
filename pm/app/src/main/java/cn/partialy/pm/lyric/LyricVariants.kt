package cn.partialy.pm.lyric

/**
 * 同一首歌曲可用的逐字、逐行歌词。
 *
 * [word] 仅保存通过逐字时间轴校验的 KRC/YRC，[line] 保存可解析的逐行 LRC。
 */
data class LyricVariants(
    val word: RawLyric? = null,
    val line: RawLyric? = null,
) {
    fun bestOrEmpty(source: String): RawLyric =
        word ?: line ?: RawLyric("", LyricFormat.NONE, source)

    companion object {
        val EMPTY = LyricVariants()
    }
}
