package cn.partialy.pm.ui.player.lyricstyle

import android.text.TextPaint
import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.ui.player.LyricAlignment
import cn.partialy.pm.ui.player.LyricDisplayStyle
import java.text.BreakIterator
import kotlin.math.floor
import kotlin.math.max

data class WrappedSegment(
    val text: String,
    val startChar: Int,
    val endChar: Int,
)

data class EffectGlyph(
    val text: String,
    val x: Float,
    val baselineY: Float,
    val width: Float,
    val logicalX: Float,
    val startTimeMs: Long,
    val endTimeMs: Long,
    val rowIndex: Int,
)

data class EffectRun(
    val text: String,
    val x: Float,
    val baselineY: Float,
    val width: Float,
    val logicalX: Float,
    val startTimeMs: Long,
    val endTimeMs: Long,
    val rowIndex: Int,
)

data class EffectVisualRow(
    val rowIndex: Int,
    val rowOffset: Int,
    val baselineY: Float,
    val left: Float,
    val right: Float,
    val glyphs: List<EffectGlyph>,
)

data class EffectLineLayout(
    val segments: List<WrappedSegment>,
    val glyphs: List<EffectGlyph>,
    val runs: List<EffectRun>,
    val rows: List<EffectVisualRow>,
    val totalLogicalWidth: Float,
    val maxRowWidth: Float,
    val lineHeight: Float,
)

/**
 * 拆分自 KaraokeLyricsView 的排版与字素缓存引擎：
 * 负责多行折行、单字素时间插值、跨行 logicalX 连续性与行中心垂直偏移计算。
 */
internal class KaraokeLyricLayoutEngine {

    private data class WrapCacheKey(
        val text: String,
        val maxTextWidth: Int,
        val textSizeBits: Int,
        val bold: Boolean,
    )

    private data class EffectCacheKey(
        val lineIdentity: Int,
        val text: String,
        val maxTextWidth: Int,
        val viewWidth: Int,
        val paddingLeft: Int,
        val paddingRight: Int,
        val textSizeBits: Int,
        val bold: Boolean,
        val alignment: LyricAlignment,
        val centerBaselineBits: Int,
        val lineEndMs: Long,
    )

    private val wrapCache = LinkedHashMap<WrapCacheKey, List<WrappedSegment>>(64, 0.75f, true)
    private var lastEffectKey: EffectCacheKey? = null
    private var lastEffectLayout: EffectLineLayout? = null

    fun clearCache() {
        wrapCache.clear()
        lastEffectKey = null
        lastEffectLayout = null
    }

    fun wrapText(paint: TextPaint, text: String, maxTextWidth: Int): List<WrappedSegment> {
        if (text.isBlank() || maxTextWidth <= 0) return emptyList()
        val key = WrapCacheKey(
            text = text,
            maxTextWidth = maxTextWidth,
            textSizeBits = paint.textSize.toRawBits(),
            bold = paint.isFakeBoldText,
        )
        wrapCache[key]?.let { return it }

        val segments = mutableListOf<WrappedSegment>()
        var start = 0
        while (start < text.length) {
            val rawCount = paint.breakText(text, start, text.length, true, maxTextWidth.toFloat(), null)
                .coerceAtLeast(1)
            val rawEnd = (start + rawCount).coerceAtMost(text.length)
            val end = chooseWrapEnd(text, start, rawEnd).takeIf { it > start } ?: rawEnd
            segments += WrappedSegment(text.substring(start, end), start, end)
            start = skipLeadingWrapSeparators(text, end)
        }
        if (wrapCache.size >= MAX_WRAP_CACHE_SIZE) {
            val oldest = wrapCache.keys.firstOrNull()
            if (oldest != null) wrapCache.remove(oldest)
        }
        wrapCache[key] = segments
        return segments
    }

    fun buildCurrentLineEffectLayout(
        paint: TextPaint,
        line: LyricLine,
        lineEndMs: Long,
        centerBaseline: Float,
        maxTextWidth: Int,
        viewWidth: Int,
        paddingLeft: Int,
        paddingRight: Int,
        wrappedLineGapPx: Float,
        alignment: LyricAlignment,
    ): EffectLineLayout {
        val fullText = line.lineText
        val key = EffectCacheKey(
            lineIdentity = System.identityHashCode(line),
            text = fullText,
            maxTextWidth = maxTextWidth,
            viewWidth = viewWidth,
            paddingLeft = paddingLeft,
            paddingRight = paddingRight,
            textSizeBits = paint.textSize.toRawBits(),
            bold = paint.isFakeBoldText,
            alignment = alignment,
            centerBaselineBits = centerBaseline.toRawBits(),
            lineEndMs = lineEndMs,
        )
        if (key == lastEffectKey && lastEffectLayout != null) {
            return lastEffectLayout!!
        }

        val segments = wrapText(paint, fullText, maxTextWidth)
        val lineHeight = textHeight(paint, paint.textSize) + wrappedLineGapPx
        if (segments.isEmpty()) {
            val empty = EffectLineLayout(emptyList(), emptyList(), emptyList(), emptyList(), 0f, 0f, lineHeight)
            lastEffectKey = key
            lastEffectLayout = empty
            return empty
        }

        val charTimings = buildCharTimings(line, fullText.length, lineEndMs)
        val startBaseline = centerBaseline - (segments.size - 1) * lineHeight / 2f

        val glyphs = mutableListOf<EffectGlyph>()
        val runs = mutableListOf<EffectRun>()
        val rows = mutableListOf<EffectVisualRow>()
        var logicalX = 0f
        var maxRowWidth = 0f

        segments.forEachIndexed { rowIndex, segment ->
            val segmentBaseline = startBaseline + rowIndex * lineHeight
            val segWidth = paint.measureText(segment.text)
            maxRowWidth = max(maxRowWidth, segWidth)
            val originX = lineX(paint, segment.text, maxTextWidth, viewWidth, paddingLeft, paddingRight, alignment)
            val rowOffset = glyphs.size
            val rowGlyphs = mutableListOf<EffectGlyph>()

            val graphemeRanges = splitGraphemeRanges(segment.text)
            var cursorX = originX
            for (range in graphemeRanges) {
                val gText = segment.text.substring(range.first, range.last + 1)
                val gWidth = paint.measureText(gText)
                val globalStart = (segment.startChar + range.first).coerceIn(0, (charTimings.size - 1).coerceAtLeast(0))
                val globalEnd = (segment.startChar + range.last).coerceIn(globalStart, (charTimings.size - 1).coerceAtLeast(0))
                val tStart = charTimings.getOrNull(globalStart)?.startMs ?: line.startTime
                val tEnd = charTimings.getOrNull(globalEnd)?.endMs ?: lineEndMs

                val glyph = EffectGlyph(
                    text = gText,
                    x = cursorX,
                    baselineY = segmentBaseline,
                    width = gWidth,
                    logicalX = logicalX,
                    startTimeMs = tStart,
                    endTimeMs = max(tStart + 1L, tEnd),
                    rowIndex = rowIndex,
                )
                glyphs += glyph
                rowGlyphs += glyph
                cursorX += gWidth
                logicalX += gWidth
            }

            // 按原始 word 切分视觉行内的连续 run（供水墨、霓虹、聚光灯模糊底图高效绘制）
            if (line.hasWordTiming && line.words.isNotEmpty()) {
                var wordStart = 0
                var runLogicalX = if (rowGlyphs.isNotEmpty()) rowGlyphs.first().logicalX else logicalX
                var runX = originX
                for (word in line.words) {
                    val wordEnd = wordStart + word.word.length
                    val overlapStart = max(segment.startChar, wordStart)
                    val overlapEnd = minOf(segment.endChar, wordEnd)
                    if (overlapStart < overlapEnd) {
                        val subText = word.word.substring(overlapStart - wordStart, overlapEnd - wordStart)
                        val subWidth = paint.measureText(subText)
                        val dur = (word.endTime - word.startTime).coerceAtLeast(1L)
                        val wordLen = word.word.length.coerceAtLeast(1)
                        val subStart = word.startTime + dur * (overlapStart - wordStart) / wordLen
                        val subEnd = word.startTime + dur * (overlapEnd - wordStart) / wordLen
                        runs += EffectRun(
                            text = subText,
                            x = runX,
                            baselineY = segmentBaseline,
                            width = subWidth,
                            logicalX = runLogicalX,
                            startTimeMs = subStart,
                            endTimeMs = max(subStart + 1L, subEnd),
                            rowIndex = rowIndex,
                        )
                        runX += subWidth
                        runLogicalX += subWidth
                    }
                    wordStart = wordEnd
                }
            } else {
                val segLogicalStart = if (rowGlyphs.isNotEmpty()) rowGlyphs.first().logicalX else 0f
                runs += EffectRun(
                    text = segment.text,
                    x = originX,
                    baselineY = segmentBaseline,
                    width = segWidth,
                    logicalX = segLogicalStart,
                    startTimeMs = line.startTime,
                    endTimeMs = max(line.startTime + 1L, lineEndMs),
                    rowIndex = rowIndex,
                )
            }

            rows += EffectVisualRow(
                rowIndex = rowIndex,
                rowOffset = rowOffset,
                baselineY = segmentBaseline,
                left = originX,
                right = originX + segWidth,
                glyphs = rowGlyphs,
            )
        }

        val layout = EffectLineLayout(
            segments = segments,
            glyphs = glyphs,
            runs = runs,
            rows = rows,
            totalLogicalWidth = logicalX,
            maxRowWidth = maxRowWidth,
            lineHeight = lineHeight,
        )
        lastEffectKey = key
        lastEffectLayout = layout
        return layout
    }

    fun rowStride(
        paint: TextPaint,
        currentTextSize: Float,
        normalTextSize: Float,
        lyricRowGapPx: Float,
    ): Float = max(textHeight(paint, currentTextSize), textHeight(paint, normalTextSize)) + lyricRowGapPx

    fun rowCenterOffset(
        paint: TextPaint,
        lines: List<LyricLine>,
        index: Int,
        centerPosition: Float,
        selectedIndex: Int,
        maxTextWidth: Int,
        currentTextSize: Float,
        normalTextSize: Float,
        wrappedLineGapPx: Float,
        lyricRowGapPx: Float,
        selectedExtraVerticalPaddingPx: Float,
    ): Float {
        val lower = floor(centerPosition).toInt().coerceIn(0, lines.lastIndex)
        val upper = (lower + 1).coerceAtMost(lines.lastIndex)
        val fraction = (centerPosition - lower).coerceIn(0f, 1f)
        val fromLower = rowCenterOffsetFromAnchor(
            paint, lines, index, lower, selectedIndex, maxTextWidth,
            currentTextSize, normalTextSize, wrappedLineGapPx, lyricRowGapPx, selectedExtraVerticalPaddingPx,
        )
        val fromUpper = rowCenterOffsetFromAnchor(
            paint, lines, index, upper, selectedIndex, maxTextWidth,
            currentTextSize, normalTextSize, wrappedLineGapPx, lyricRowGapPx, selectedExtraVerticalPaddingPx,
        )
        return fromLower + (fromUpper - fromLower) * fraction
    }

    private fun rowCenterOffsetFromAnchor(
        paint: TextPaint,
        lines: List<LyricLine>,
        index: Int,
        anchor: Int,
        selectedIndex: Int,
        maxTextWidth: Int,
        currentTextSize: Float,
        normalTextSize: Float,
        wrappedLineGapPx: Float,
        lyricRowGapPx: Float,
        selectedExtraVerticalPaddingPx: Float,
    ): Float {
        if (index == anchor) return 0f
        var offset = 0f
        if (index > anchor) {
            for (i in anchor until index) {
                offset += distanceBetweenRows(
                    paint, lines, i, i + 1, selectedIndex, maxTextWidth,
                    currentTextSize, normalTextSize, wrappedLineGapPx, lyricRowGapPx, selectedExtraVerticalPaddingPx,
                )
            }
        } else {
            for (i in index until anchor) {
                offset -= distanceBetweenRows(
                    paint, lines, i, i + 1, selectedIndex, maxTextWidth,
                    currentTextSize, normalTextSize, wrappedLineGapPx, lyricRowGapPx, selectedExtraVerticalPaddingPx,
                )
            }
        }
        return offset
    }

    private fun distanceBetweenRows(
        paint: TextPaint,
        lines: List<LyricLine>,
        first: Int,
        second: Int,
        selectedIndex: Int,
        maxTextWidth: Int,
        currentTextSize: Float,
        normalTextSize: Float,
        wrappedLineGapPx: Float,
        lyricRowGapPx: Float,
        selectedExtraVerticalPaddingPx: Float,
    ): Float {
        val firstHeight = rowVisualHeight(
            paint, lines, first, selectedIndex, maxTextWidth,
            currentTextSize, normalTextSize, wrappedLineGapPx, lyricRowGapPx, selectedExtraVerticalPaddingPx,
        )
        val secondHeight = rowVisualHeight(
            paint, lines, second, selectedIndex, maxTextWidth,
            currentTextSize, normalTextSize, wrappedLineGapPx, lyricRowGapPx, selectedExtraVerticalPaddingPx,
        )
        return (firstHeight + secondHeight) / 2f + lyricRowGapPx
    }

    private fun rowVisualHeight(
        paint: TextPaint,
        lines: List<LyricLine>,
        index: Int,
        selectedIndex: Int,
        maxTextWidth: Int,
        currentTextSize: Float,
        normalTextSize: Float,
        wrappedLineGapPx: Float,
        lyricRowGapPx: Float,
        selectedExtraVerticalPaddingPx: Float,
    ): Float {
        if (index !in lines.indices) return rowStride(paint, currentTextSize, normalTextSize, lyricRowGapPx)
        paint.textSize = if (index == selectedIndex) currentTextSize else normalTextSize
        val segmentCount = wrapText(paint, lines[index].lineText, maxTextWidth).size.coerceAtLeast(1)
        val lineHeight = textHeight(paint, paint.textSize) + wrappedLineGapPx
        val extra = if (index == selectedIndex) selectedExtraVerticalPaddingPx else 0f
        return lineHeight * segmentCount - wrappedLineGapPx + extra
    }

    fun drawWrappedSegmentsCentered(
        paint: TextPaint,
        segments: List<WrappedSegment>,
        centerBaseline: Float,
        wrappedLineGapPx: Float,
        drawSegment: (WrappedSegment, Float) -> Unit,
    ) {
        if (segments.isEmpty()) return
        val lineHeight = textHeight(paint, paint.textSize) + wrappedLineGapPx
        val startBaseline = centerBaseline - (segments.size - 1) * lineHeight / 2f
        segments.forEachIndexed { index, segment ->
            drawSegment(segment, startBaseline + index * lineHeight)
        }
    }

    fun lineX(
        paint: TextPaint,
        text: String,
        maxTextWidth: Int,
        viewWidth: Int,
        paddingLeft: Int,
        paddingRight: Int,
        alignment: LyricAlignment,
    ): Float {
        val textWidth = paint.measureText(text)
        return when (alignment) {
            LyricAlignment.START -> paddingLeft.toFloat()
            LyricAlignment.CENTER -> paddingLeft + (maxTextWidth - textWidth) / 2f
            LyricAlignment.END -> viewWidth - paddingRight - textWidth
        }
    }

    fun textHeight(paint: TextPaint, textSize: Float): Float {
        paint.textSize = textSize
        return paint.fontMetrics.run { descent - ascent }
    }

    fun textCenterOffset(paint: TextPaint, textSize: Float): Float {
        paint.textSize = textSize
        return (paint.ascent() + paint.descent()) / 2f
    }

    fun resolveLineEndTimeMs(lines: List<LyricLine>, index: Int): Long {
        val line = lines.getOrNull(index) ?: return 1L
        val nextStart = lines.getOrNull(index + 1)?.startTime ?: line.endTime
        return max(line.startTime + 400L, max(line.endTime, nextStart))
    }

    private fun chooseWrapEnd(text: String, start: Int, rawEnd: Int): Int {
        if (rawEnd >= text.length) return text.length
        for (i in rawEnd downTo start + 1) {
            if (isWrapBoundary(text[i - 1])) return i
        }
        return rawEnd
    }

    private fun skipLeadingWrapSeparators(text: String, start: Int): Int {
        var index = start
        while (index < text.length && text[index].isWhitespace()) {
            index++
        }
        return index
    }

    private fun isWrapBoundary(ch: Char): Boolean =
        ch.isWhitespace() || ch in WRAP_BOUNDARY_CHARS

    internal companion object {
        private const val MAX_WRAP_CACHE_SIZE = 120
        private const val WRAP_BOUNDARY_CHARS = "，。！？、；：,.!?;:)]）】》"

        data class CharTiming(val startMs: Long, val endMs: Long)

        fun splitGraphemeRanges(text: String): List<IntRange> {
            if (text.isEmpty()) return emptyList()
            val ranges = mutableListOf<IntRange>()
            val iterator = BreakIterator.getCharacterInstance()
            iterator.setText(text)
            var start = iterator.first()
            var end = iterator.next()
            while (end != BreakIterator.DONE) {
                if (end > start) {
                    ranges += start until end
                }
                start = end
                end = iterator.next()
            }
            return ranges
        }

        fun buildCharTimings(line: LyricLine, fullLength: Int, lineEndMs: Long): List<CharTiming> {
            if (fullLength <= 0) return emptyList()
            val safeLineEnd = max(line.startTime + 1L, lineEndMs)
            val result = ArrayList<CharTiming>(fullLength)
            if (line.hasWordTiming && line.words.isNotEmpty()) {
                for (word in line.words) {
                    val wordText = word.word
                    if (wordText.isEmpty()) continue
                    val ranges = splitGraphemeRanges(wordText)
                    val gCount = ranges.size.coerceAtLeast(1)
                    val dur = (word.endTime - word.startTime).coerceAtLeast(1L)
                    ranges.forEachIndexed { gIdx, range ->
                        val t0 = word.startTime + dur * gIdx / gCount
                        val t1 = max(t0 + 1L, word.startTime + dur * (gIdx + 1) / gCount)
                        repeat(range.last - range.first + 1) {
                            result += CharTiming(t0, t1)
                        }
                    }
                }
            }
            if (result.size < fullLength) {
                val dur = (safeLineEnd - line.startTime).coerceAtLeast(1L)
                for (i in result.size until fullLength) {
                    val t0 = line.startTime + dur * i / fullLength
                    val t1 = max(t0 + 1L, line.startTime + dur * (i + 1) / fullLength)
                    result += CharTiming(t0, t1)
                }
            }
            return result
        }
    }
}
