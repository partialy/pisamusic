package cn.partialy.pm.ui.player.lyricstyle

import android.graphics.Canvas
import android.graphics.Color
import android.text.TextPaint
import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.ui.player.LyricDisplayStyle
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.sin

/**
 * 默认经典歌词渲染器：完整保留原有逐字裁剪高亮与可选逐字正弦放大效果。
 */
internal class DefaultLyricLineRenderer(
    private val layoutEngine: KaraokeLyricLayoutEngine,
) : LyricEffectRenderer {

    override fun drawCurrentLine(canvas: Canvas, frame: LyricEffectRenderFrame) {
        val paint = frame.paint
        val style = frame.displayStyle
        val line = frame.line
        val baseColor = currentBaseColor(style)
        val segments = frame.layout.segments
        if (segments.isEmpty()) return

        layoutEngine.drawWrappedSegmentsCentered(
            paint = paint,
            segments = segments,
            centerBaseline = frame.centerBaseline,
            wrappedLineGapPx = frame.wrappedLineGapPx,
        ) { segment, segmentBaseline ->
            val x = layoutEngine.lineX(
                paint = paint,
                text = segment.text,
                maxTextWidth = frame.maxTextWidth,
                viewWidth = frame.viewWidth,
                paddingLeft = frame.paddingLeft,
                paddingRight = frame.paddingRight,
                alignment = style.alignment,
            )

            if (!frame.showProgress) {
                paint.color = baseColor
                canvas.drawText(segment.text, x, segmentBaseline, paint)
                return@drawWrappedSegmentsCentered
            }

            if (!frame.wordMode || !line.hasWordTiming) {
                paint.color = style.currentColorArgb
                canvas.drawText(segment.text, x, segmentBaseline, paint)
                return@drawWrappedSegmentsCentered
            }

            val activeRange = activeWordRange(line, segment, style, frame.positionMs)
            drawSegmentExceptRange(canvas, paint, segment.text, x, segmentBaseline, activeRange, baseColor, style)

            val sungWidth = calculateSungWidthInSegment(paint, line, segment, frame.positionMs)
            if (sungWidth > 0f) {
                canvas.save()
                canvas.clipRect(
                    x,
                    0f,
                    x + sungWidth.coerceAtMost(paint.measureText(segment.text)),
                    frame.viewHeight.toFloat(),
                )
                drawSegmentExceptRange(
                    canvas,
                    paint,
                    segment.text,
                    x,
                    segmentBaseline,
                    activeRange,
                    style.currentColorArgb,
                    style,
                )
                canvas.restore()
            }

            drawActiveWordScale(
                canvas = canvas,
                paint = paint,
                line = line,
                segment = segment,
                originX = x,
                baseline = segmentBaseline,
                clipLeft = frame.paddingLeft.toFloat(),
                clipRight = (frame.viewWidth - frame.paddingRight).toFloat(),
                viewHeight = frame.viewHeight.toFloat(),
                style = style,
                baseColor = baseColor,
                positionMs = frame.positionMs,
            )
        }
    }

    private fun drawActiveWordScale(
        canvas: Canvas,
        paint: TextPaint,
        line: LyricLine,
        segment: WrappedSegment,
        originX: Float,
        baseline: Float,
        clipLeft: Float,
        clipRight: Float,
        viewHeight: Float,
        style: LyricDisplayStyle,
        baseColor: Int,
        positionMs: Long,
    ) {
        if (!style.wordScaleEnabled || !line.hasWordTiming || line.words.isEmpty()) return
        var wordStart = 0
        for (word in line.words) {
            val wordEnd = wordStart + word.word.length
            val active = positionMs in word.startTime until word.endTime
            val overlapStart = max(segment.startChar, wordStart)
            val overlapEnd = minOf(segment.endChar, wordEnd)
            if (active && overlapStart < overlapEnd) {
                val beforeText = segment.text.take(overlapStart - segment.startChar)
                val text = word.word.substring(overlapStart - wordStart, overlapEnd - wordStart)
                val wordX = originX + paint.measureText(beforeText)
                val wordWidth = paint.measureText(text)
                val duration = (word.endTime - word.startTime).coerceAtLeast(1L)
                val elapsed = (positionMs - word.startTime).coerceIn(0L, duration)
                val phase = elapsed.toFloat() / duration.toFloat()
                val scale = 1f + 0.14f * sin(phase.toDouble() * PI).toFloat()
                val pivotX = wordX + wordWidth / 2f
                val sungRight = (originX + calculateSungWidthInSegment(paint, line, segment, positionMs))
                    .coerceIn(clipLeft, clipRight)

                canvas.save()
                canvas.clipRect(clipLeft, 0f, clipRight, viewHeight)
                canvas.translate(pivotX, baseline)
                canvas.scale(scale, scale)
                canvas.translate(-pivotX, -baseline)
                paint.color = baseColor
                canvas.drawText(text, wordX, baseline, paint)
                canvas.restore()

                if (sungRight > clipLeft) {
                    canvas.save()
                    canvas.clipRect(clipLeft, 0f, sungRight, viewHeight)
                    canvas.translate(pivotX, baseline)
                    canvas.scale(scale, scale)
                    canvas.translate(-pivotX, -baseline)
                    paint.color = style.currentColorArgb
                    canvas.drawText(text, wordX, baseline, paint)
                    canvas.restore()
                }
                return
            }
            wordStart = wordEnd
        }
    }

    private fun drawSegmentExceptRange(
        canvas: Canvas,
        paint: TextPaint,
        text: String,
        x: Float,
        baseline: Float,
        skipRange: IntRange?,
        color: Int,
        style: LyricDisplayStyle,
    ) {
        paint.color = color
        if (!style.wordScaleEnabled || skipRange == null) {
            canvas.drawText(text, x, baseline, paint)
            return
        }
        val start = skipRange.first.coerceIn(0, text.length)
        val endExclusive = (skipRange.last + 1).coerceIn(start, text.length)
        if (start > 0) {
            canvas.drawText(text.substring(0, start), x, baseline, paint)
        }
        if (endExclusive < text.length) {
            val suffixX = x + paint.measureText(text.substring(0, endExclusive))
            canvas.drawText(text.substring(endExclusive), suffixX, baseline, paint)
        }
    }

    private fun activeWordRange(
        line: LyricLine,
        segment: WrappedSegment,
        style: LyricDisplayStyle,
        positionMs: Long,
    ): IntRange? {
        if (!style.wordScaleEnabled || !line.hasWordTiming || line.words.isEmpty()) return null
        var wordStart = 0
        for (word in line.words) {
            val wordEnd = wordStart + word.word.length
            val active = positionMs in word.startTime until word.endTime
            val overlapStart = max(segment.startChar, wordStart)
            val overlapEnd = minOf(segment.endChar, wordEnd)
            if (active && overlapStart < overlapEnd) {
                return (overlapStart - segment.startChar) until (overlapEnd - segment.startChar)
            }
            wordStart = wordEnd
        }
        return null
    }

    private fun calculateSungWidthInSegment(
        paint: TextPaint,
        line: LyricLine,
        segment: WrappedSegment,
        positionMs: Long,
    ): Float {
        var width = 0f
        var wordStart = 0
        for (word in line.words) {
            val wordEnd = wordStart + word.word.length
            val overlapStart = max(segment.startChar, wordStart)
            val overlapEnd = minOf(segment.endChar, wordEnd)
            if (overlapStart >= overlapEnd) {
                wordStart = wordEnd
                continue
            }
            val text = word.word.substring(overlapStart - wordStart, overlapEnd - wordStart)
            val wordWidth = paint.measureText(text)
            width += when {
                positionMs >= word.endTime -> wordWidth
                positionMs <= word.startTime -> 0f
                else -> {
                    val duration = (word.endTime - word.startTime).coerceAtLeast(1L)
                    val elapsed = (positionMs - word.startTime).coerceIn(0L, duration)
                    wordWidth * elapsed.toFloat() / duration.toFloat()
                }
            }
            wordStart = wordEnd
        }
        return width
    }

    private fun currentBaseColor(style: LyricDisplayStyle): Int = Color.argb(
        255,
        Color.red(style.normalColorArgb),
        Color.green(style.normalColorArgb),
        Color.blue(style.normalColorArgb),
    )
}
