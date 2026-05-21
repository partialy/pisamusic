// ============================================================
// LyricParser.kt — 多格式歌词解析工具
// 支持：LRC 单行歌词 / KRC 逐字歌词 / YRC 逐字歌词（Y 格式）
// 用法：LyricParser.parseLrc(text) / LyricParser.parseKrc(text) / LyricParser.parseYrc(text)
// ============================================================

/**
 * 一个歌词单词
 *
 * @property startTime 单词的起始时间，单位为毫秒
 * @property endTime   单词的结束时间，单位为毫秒
 * @property word      单词内容
 */
data class LyricWord(
    val startTime: Long,
    val endTime: Long,
    val word: String,
)

/**
 * 一行歌词，存储多个单词
 *
 * @property words     该行的所有单词。
 *                     如果是 LRC 等只能表达一行歌词的格式，这里就只会有一个单词，
 *                     且通常其始末时间和本结构的 [startTime] 与 [endTime] 相同。
 * @property startTime 句子的起始时间，单位为毫秒
 * @property endTime   句子的结束时间，单位为毫秒
 */
data class LyricLine(
    val words: List<LyricWord>,
    val startTime: Long,
    val endTime: Long,
)

object LyricParser {

    // ─────────────────────────────────────────────────────────
    // 工具：统一换行符，兼容以下三种情况：
    //   1. 真实换行符  \r\n / \n（正常文件读取）
    //   2. 字面量转义  \\r\\n / \\n（JSON 字符串、网络传输等场景）
    // ─────────────────────────────────────────────────────────
    private fun normalizeNewlines(text: String): String =
        text
            // 先把字面量 \r\n（4个字符：\ r \ n）替换成真实换行
            .replace("""\\r\\n""", "\n")
            // 再把剩余字面量 \n（2个字符：\ n）替换成真实换行
            .replace("""\\n""", "\n")
            // 最后把真实 \r\n 也统一成 \n，方便后续 split
            .replace("\r\n", "\n")

    // ─────────────────────────────────────────────────────────
    // 工具：将 "mm:ss.xx" 或 "mm:ss.xxx" 格式时间戳转换为毫秒
    // ─────────────────────────────────────────────────────────
    private val timestampRegex = Regex("""^(\d+):(\d+)\.(\d+)$""")

    private fun parseTimestamp(ts: String): Long {
        // 匹配 mm:ss.xx / mm:ss.xxx 两种精度
        val m = timestampRegex.matchEntire(ts) ?: return 0L
        val minutes = m.groupValues[1].toLong()
        val seconds = m.groupValues[2].toLong()
        // 小数部分：统一转换成毫秒（支持 2 位 / 3 位小数）
        val msStr = m.groupValues[3].padEnd(3, '0').take(3)
        val ms = msStr.toLong()
        return minutes * 60_000L + seconds * 1_000L + ms
    }

    /**
     * 解析 LRC 格式歌词（单行歌词，每行只有整句时间戳）
     *
     * @param lrc 原始 LRC 文本字符串
     * @return [LyricLine] 列表，每行包含一个 word，
     *         startTime 取当前行时间戳，endTime 取下一行时间戳（最后一行与 startTime 相同）
     *
     * 示例：
     * ```kotlin
     * val lines = LyricParser.parseLrc("[00:19.34]今天我\n[00:22.99]寒夜里看雪飘过")
     * // lines[0] => LyricLine(startTime=19340, endTime=22990, words=[LyricWord(word="今天我", ...)])
     * ```
     */
    fun parseLrc(lrc: String): List<LyricLine> {
        // 统一换行符（兼容真实换行与字面量 \r\n / \n），再按行拆分
        val rawLines = normalizeNewlines(lrc).split("\n")

        // 匹配 [mm:ss.xx]歌词 格式行，跳过 [ti:xxx] 等元数据行
        val timestampLineRegex = Regex("""^\[(\d+:\d+\.\d+)\](.*)$""")

        // 收集所有有效的时间戳行
        data class Entry(val time: Long, val text: String)
        val entries = mutableListOf<Entry>()

        for (raw in rawLines) {
            val line = raw.trim()
            if (line.isEmpty()) continue

            // 跳过元数据行，例如 [ti:...] [ar:...] [offset:...]
            val match = timestampLineRegex.matchEntire(line) ?: continue

            val time = parseTimestamp(match.groupValues[1])
            val text = match.groupValues[2].trim()

            // 过滤空文本行（部分 LRC 文件末尾有空时间戳行）
            if (text.isNotEmpty()) {
                entries += Entry(time, text)
            }
        }

        // 按时间升序排序（部分文件时间戳乱序）
        entries.sortBy { it.time }

        // 构造 LyricLine：endTime = 下一行的 startTime，最后一行 endTime = startTime
        return entries.mapIndexed { idx, entry ->
            val startTime = entry.time
            val endTime = if (idx < entries.lastIndex) entries[idx + 1].time else entry.time
            val word = LyricWord(startTime = startTime, endTime = endTime, word = entry.text)
            LyricLine(words = listOf(word), startTime = startTime, endTime = endTime)
        }
    }

    /**
     * 解析 KRC 格式歌词（逐字歌词，酷狗格式）
     *
     * KRC 行格式：`[行起始ms,行时长ms]<字偏移ms,字时长ms,0>字符...`
     *
     * @param krc 原始 KRC 文本字符串（纯文本，非加密版本）
     * @return [LyricLine] 列表，每行 words 包含逐字时间信息
     *
     * 示例：
     * ```kotlin
     * val lines = LyricParser.parseKrc("[19340,3650]<0,500,0>今<500,600,0>天<1100,800,0>我")
     * // lines[0].words => [LyricWord(word="今", startTime=19340, endTime=19840), ...]
     * ```
     */
    fun parseKrc(krc: String): List<LyricLine> {
        // 统一换行符后按行拆分
        val rawLines = normalizeNewlines(krc).split("\n")
        val lines = mutableListOf<LyricLine>()

        // 匹配行头：[起始时间ms, 持续时间ms]
        val lineHeaderRegex = Regex("""^\[(\d+),(\d+)\]""")
        // 匹配单字块：<相对偏移ms, 持续时间ms, 0>字符内容
        val wordBlockRegex = Regex("""<(\d+),(\d+),\d+>([^<]*)""")

        for (raw in rawLines) {
            val line = raw.trim()
            if (line.isEmpty()) continue

            // 解析行头，获取该行起始时间和总时长
            val headerMatch = lineHeaderRegex.find(line) ?: continue
            val lineStart = headerMatch.groupValues[1].toLong()
            val lineDuration = headerMatch.groupValues[2].toLong()
            val lineEnd = lineStart + lineDuration

            // 提取行头之后的逐字内容部分
            val wordsPart = line.substring(headerMatch.value.length)
            val words = mutableListOf<LyricWord>()

            // 逐一匹配 <offset,duration,0>text 块
            for (wm in wordBlockRegex.findAll(wordsPart)) {
                val relOffset = wm.groupValues[1].toLong()  // 相对于行起始的偏移
                val wordDuration = wm.groupValues[2].toLong()
                val wordText = wm.groupValues[3]

                // 跳过内容为空的块（部分 KRC 末尾有空块）
                if (wordText.isEmpty()) continue

                val wordStart = lineStart + relOffset
                val wordEnd = wordStart + wordDuration
                words += LyricWord(startTime = wordStart, endTime = wordEnd, word = wordText)
            }

            if (words.isEmpty()) continue
            lines += LyricLine(words = words, startTime = lineStart, endTime = lineEnd)
        }

        // 按行起始时间升序排序
        lines.sortBy { it.startTime }
        return lines
    }

    /**
     * 解析 YRC 格式歌词（逐字歌词，网易云音乐 Y 格式）
     *
     * YRC 行格式：`[行起始ms,行时长ms](字起始ms,字时长ms,0)字符...`
     *
     * 与 KRC 的区别：
     * - 字块使用 `()` 而非 `<>` 包裹
     * - 字块内的时间是**绝对时间**（字自身的起始 ms），而非相对于行的偏移
     *
     * @param yrc 原始 YRC 文本字符串
     * @return [LyricLine] 列表，每行 words 包含逐字时间信息
     *
     * 示例：
     * ```kotlin
     * val lines = LyricParser.parseYrc("[19340,3650](19340,500,0)今(19840,600,0)天(20440,800,0)我")
     * // lines[0].words => [LyricWord(word="今", startTime=19340, endTime=19840), ...]
     * ```
     */
    fun parseYrc(yrc: String): List<LyricLine> {
        // 统一换行符后按行拆分
        val rawLines = normalizeNewlines(yrc).split("\n")
        val lines = mutableListOf<LyricLine>()

        // 匹配行头：[起始时间ms, 持续时间ms]
        val lineHeaderRegex = Regex("""^\[(\d+),(\d+)\]""")
        // 匹配单字块：(绝对起始ms, 持续时间ms, 0)字符内容
        val wordBlockRegex = Regex("""\((\d+),(\d+),\d+\)([^(]*)""")

        for (raw in rawLines) {
            val line = raw.trim()
            if (line.isEmpty()) continue

            // 解析行头
            val headerMatch = lineHeaderRegex.find(line) ?: continue
            val lineStart = headerMatch.groupValues[1].toLong()
            val lineDuration = headerMatch.groupValues[2].toLong()
            val lineEnd = lineStart + lineDuration

            // 提取行头之后的逐字内容
            val wordsPart = line.substring(headerMatch.value.length)
            val words = mutableListOf<LyricWord>()

            // 逐一匹配 (startMs,duration,0)text 块
            for (wm in wordBlockRegex.findAll(wordsPart)) {
                val wordStart = wm.groupValues[1].toLong()    // 绝对起始时间
                val wordDuration = wm.groupValues[2].toLong()
                val wordText = wm.groupValues[3]

                if (wordText.isEmpty()) continue

                val wordEnd = wordStart + wordDuration
                words += LyricWord(startTime = wordStart, endTime = wordEnd, word = wordText)
            }

            if (words.isEmpty()) continue
            lines += LyricLine(words = words, startTime = lineStart, endTime = lineEnd)
        }

        // 按行起始时间升序排序
        lines.sortBy { it.startTime }
        return lines
    }
}