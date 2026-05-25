package cn.partialy.pm.ui.player

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.TextPaint
import android.util.AttributeSet
import android.view.Choreographer
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewConfiguration
import android.widget.OverScroller
import cn.partialy.pm.lyric.LyricLine
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

class KaraokeLyricsView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

    var onBrowseLineChanged: ((Int) -> Unit)? = null
    var onBrowseEnded: (() -> Unit)? = null

    private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.LEFT
    }
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scroller = OverScroller(context)
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private val minimumFlingVelocity = ViewConfiguration.get(context).scaledMinimumFlingVelocity
    private val maximumFlingVelocity = ViewConfiguration.get(context).scaledMaximumFlingVelocity

    private var velocityTracker: VelocityTracker? = null
    private var lastTouchY = 0f
    private var touchDownY = 0f
    private var isDragging = false
    private var browseCenterPosition = 0f
    private var browseLineIndex = -1
    private var isBrowsing = false
    private var isAutoReturning = false
    private var returnStartPosition = 0f
    private var returnCenterPosition = 0f
    private var returnStartUptimeMs = 0L

    private var lines: List<LyricLine> = emptyList()
    private var currentIndex: Int = -1
    private var style: LyricDisplayStyle = LyricDisplayStyle.DEFAULT

    private var anchorPositionMs: Long = 0L
    private var anchorUptimeMs: Long = 0L
    private var isPlaying: Boolean = false
    private var positionMs: Long = 0L

    private var prevCurrentIndex: Int = -1
    private var lineAnimStartUptimeMs: Long = 0L
    private var lineAnimDurationMs: Long = 380L
    private var lineAnimProgress: Float = 1f

    private var scaleAnimProgress: Float = 1f
    private var scaleAnimStartUptimeMs: Long = 0L
    private val scaleAnimDurationMs = 300L

    private val choreographer: Choreographer = Choreographer.getInstance()
    private lateinit var frameCallback: Choreographer.FrameCallback

    private val browseTimeoutRunnable = Runnable {
        startAutoReturnToPlayback(notify = true)
    }

    init {
        isClickable = true
        frameCallback = Choreographer.FrameCallback { frameTimeNanos ->
            val frameUptimeMs = frameTimeNanos / 1_000_000L
            var needNextFrame = false

            if (isPlaying && lines.isNotEmpty() && currentIndex in lines.indices) {
                positionMs = anchorPositionMs + (frameUptimeMs - anchorUptimeMs)
                needNextFrame = true
            }

            if (lineAnimProgress < 1f) {
                val elapsed = frameUptimeMs - lineAnimStartUptimeMs
                lineAnimProgress = (elapsed.toFloat() / lineAnimDurationMs).coerceIn(0f, 1f)
                needNextFrame = true
            }

            if (scaleAnimProgress < 1f) {
                val elapsed = frameUptimeMs - scaleAnimStartUptimeMs
                scaleAnimProgress = (elapsed.toFloat() / scaleAnimDurationMs).coerceIn(0f, 1f)
                needNextFrame = true
            }

            if (!scroller.isFinished) {
                if (scroller.computeScrollOffset()) {
                    browseCenterPosition = (scroller.currY / SCROLLER_ROW_UNIT).coerceIn(0f, lines.lastIndex.toFloat())
                    notifyBrowseLineChanged()
                    needNextFrame = true
                } else {
                    scroller.forceFinished(true)
                    snapBrowseCenter()
                }
            }

            if (isAutoReturning) {
                val elapsed = frameUptimeMs - returnStartUptimeMs
                val progress = (elapsed.toFloat() / RETURN_ANIM_DURATION_MS).coerceIn(0f, 1f)
                val target = currentIndex.coerceIn(0, lines.lastIndex).toFloat()
                returnCenterPosition = returnStartPosition + (target - returnStartPosition) * easeOutCubic(progress)
                if (progress >= 1f) {
                    isAutoReturning = false
                    isBrowsing = false
                    browseCenterPosition = target
                    invalidate()
                } else {
                    needNextFrame = true
                }
            }

            if (needNextFrame) {
                invalidate()
                choreographer.postFrameCallback(frameCallback)
            }
        }
    }

    val browsedLineIndex: Int
        get() = if (isBrowsing && !isAutoReturning) browseLineIndex else -1

    fun resumeAutoScroll() {
        finishBrowsing(notify = true)
    }

    fun bind(
        lines: List<LyricLine>,
        currentIndex: Int,
        positionMs: Long,
        isPlaying: Boolean = true,
        style: LyricDisplayStyle,
    ) {
        val oldSize = this.style.textSizeSp
        this.lines = lines
        this.style = style

        if (currentIndex != this.currentIndex) {
            val delta = abs(currentIndex - this.currentIndex)
            if (this.currentIndex >= 0) {
                lineAnimDurationMs = when {
                    delta == 1 -> 380L
                    delta <= 3 -> 280L
                    else -> 180L
                }
                prevCurrentIndex = this.currentIndex
                lineAnimProgress = 0f
                lineAnimStartUptimeMs = SystemClock.uptimeMillis()
                scaleAnimProgress = 0f
                scaleAnimStartUptimeMs = lineAnimStartUptimeMs
            }
            this.currentIndex = currentIndex
        }

        val wasPlaying = this.isPlaying
        this.isPlaying = isPlaying
        anchorPositionMs = positionMs
        anchorUptimeMs = SystemClock.uptimeMillis()
        this.positionMs = positionMs

        if (isBrowsing && !isAutoReturning) {
            browseCenterPosition = browseCenterPosition.coerceIn(0f, lines.lastIndex.toFloat())
            notifyBrowseLineChanged()
        }

        if (oldSize != style.textSizeSp) requestLayout()

        if ((isPlaying && !wasPlaying) ||
            lineAnimProgress < 1f ||
            scaleAnimProgress < 1f ||
            !scroller.isFinished ||
            isAutoReturning
        ) {
            choreographer.postFrameCallback(frameCallback)
        }
        invalidate()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (lines.isEmpty()) return super.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                scroller.forceFinished(true)
                velocityTracker = VelocityTracker.obtain().also { it.addMovement(event) }
                lastTouchY = event.y
                touchDownY = event.y
                isDragging = false
                isAutoReturning = false
                beginBrowsing()
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                velocityTracker?.addMovement(event)
                val dy = event.y - lastTouchY
                if (!isDragging && abs(event.y - touchDownY) > touchSlop) {
                    isDragging = true
                }
                if (isDragging) {
                    val stride = rowStride().coerceAtLeast(1f)
                    browseCenterPosition = (browseCenterPosition - dy / stride)
                        .coerceIn(0f, lines.lastIndex.toFloat())
                    notifyBrowseLineChanged()
                    resetBrowseTimeout()
                    invalidate()
                }
                lastTouchY = event.y
                return true
            }
            MotionEvent.ACTION_UP -> {
                velocityTracker?.addMovement(event)
                velocityTracker?.computeCurrentVelocity(1000, maximumFlingVelocity.toFloat())
                val velocityY = velocityTracker?.yVelocity ?: 0f
                recycleVelocityTracker()
                parent?.requestDisallowInterceptTouchEvent(false)
                if (!isDragging) performClick()
                isDragging = false
                if (abs(velocityY) >= minimumFlingVelocity) {
                    startBrowseFling(velocityY)
                } else {
                    snapBrowseCenter()
                }
                resetBrowseTimeout()
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                recycleVelocityTracker()
                parent?.requestDisallowInterceptTouchEvent(false)
                isDragging = false
                snapBrowseCenter()
                resetBrowseTimeout()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (visibility == VISIBLE && (isPlaying || !scroller.isFinished)) {
            anchorUptimeMs = SystemClock.uptimeMillis()
            choreographer.postFrameCallback(frameCallback)
        } else {
            choreographer.removeFrameCallback(frameCallback)
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        choreographer.removeFrameCallback(frameCallback)
        mainHandler.removeCallbacks(browseTimeoutRunnable)
        recycleVelocityTracker()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (lines.isEmpty() || currentIndex !in lines.indices) return
        val maxTextWidth = currentMaxTextWidth()
        if (maxTextWidth <= 0) return

        val currentTextSize = currentTextSizePx()
        val normalTextSize = normalTextSizePx()
        val rowStride = rowStride()
        val centerBaseline = height / 2f - textCenterOffset(currentTextSize)

        val scrollT = easeOutQuart(lineAnimProgress)
        val scrollOffset = if (!isBrowsing && lineAnimProgress < 1f && prevCurrentIndex >= 0) {
            (currentIndex - prevCurrentIndex) * (1f - scrollT)
        } else {
            0f
        }

        val centerPosition = if (isAutoReturning) {
            returnCenterPosition
        } else if (isBrowsing) {
            browseCenterPosition
        } else {
            currentIndex - scrollOffset
        }.coerceIn(0f, lines.lastIndex.toFloat())

        val selectedIndex = if (isBrowsing && !isAutoReturning) {
            browseCenterPosition.roundToInt().coerceIn(0, lines.lastIndex)
        } else {
            currentIndex
        }
        val visibleRadius = max(1, (height / rowStride).roundToInt() / 2 + 2)
        val first = floor(centerPosition - visibleRadius).toInt().coerceAtLeast(0)
        val last = floor(centerPosition + visibleRadius).toInt().coerceAtMost(lines.lastIndex)

        for (index in first..last) {
            val isSelected = index == selectedIndex
            paint.textSize = if (isSelected) currentTextSize else normalTextSize
            paint.isFakeBoldText = isSelected && style.currentLineBold

            val baseline = centerBaseline + rowCenterOffset(index, centerPosition, selectedIndex, maxTextWidth)
            if (baseline < -rowStride || baseline > height + rowStride) continue

            if (isSelected && !isBrowsing && scaleAnimProgress < 1f) {
                val scale = 0.93f + 0.07f * easeOutQuad(scaleAnimProgress)
                canvas.save()
                canvas.translate(width / 2f, baseline)
                canvas.scale(scale, scale)
                canvas.translate(-width / 2f, -baseline)
                drawCurrentLine(canvas, lines[index], baseline, maxTextWidth, showProgress = true)
                canvas.restore()
            } else if (isSelected) {
                drawCurrentLine(
                    canvas = canvas,
                    line = lines[index],
                    baseline = baseline,
                    maxTextWidth = maxTextWidth,
                    showProgress = !isBrowsing || index == currentIndex,
                )
            } else {
                drawNormalLine(canvas, lines[index], baseline, maxTextWidth)
            }
        }
    }

    private fun drawCurrentLine(
        canvas: Canvas,
        line: LyricLine,
        baseline: Float,
        maxTextWidth: Int,
        showProgress: Boolean,
    ) {
        val fullText = line.lineText
        paint.textSize = currentTextSizePx()
        paint.color = currentBaseColor()
        val segments = wrapText(fullText, maxTextWidth)
        drawWrappedSegmentsCentered(segments, baseline) { segment, segmentBaseline ->
            val x = lineX(segment.text, maxTextWidth)
            val activeRange = activeWordRange(line, segment)
            paint.color = currentBaseColor()
            drawSegmentExceptRange(canvas, segment.text, x, segmentBaseline, activeRange, currentBaseColor())

            if (showProgress && line.hasWordTiming) {
                val sungWidth = calculateSungWidthInSegment(line, segment)
                if (sungWidth > 0f) {
                    canvas.save()
                    canvas.clipRect(x, 0f, x + sungWidth.coerceAtMost(paint.measureText(segment.text)), height.toFloat())
                    drawSegmentExceptRange(canvas, segment.text, x, segmentBaseline, activeRange, style.currentColorArgb)
                    canvas.restore()
                }
                drawActiveWordScale(
                    canvas = canvas,
                    line = line,
                    segment = segment,
                    originX = x,
                    baseline = segmentBaseline,
                    clipLeft = paddingLeft.toFloat(),
                    clipRight = (width - paddingRight).toFloat(),
                )
            }
        }
    }

    private fun drawNormalLine(
        canvas: Canvas,
        line: LyricLine,
        baseline: Float,
        maxTextWidth: Int,
    ) {
        paint.textSize = normalTextSizePx()
        paint.color = style.resolvedNormalColor()
        val segments = wrapText(line.lineText, maxTextWidth)
        drawWrappedSegmentsCentered(segments, baseline) { segment, segmentBaseline ->
            canvas.drawText(segment.text, lineX(segment.text, maxTextWidth), segmentBaseline, paint)
        }
    }

    private fun drawActiveWordScale(
        canvas: Canvas,
        line: LyricLine,
        segment: WrappedSegment,
        originX: Float,
        baseline: Float,
        clipLeft: Float,
        clipRight: Float,
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
                val sungRight = (originX + calculateSungWidthInSegment(line, segment))
                    .coerceIn(clipLeft, clipRight)

                canvas.save()
                canvas.clipRect(clipLeft, 0f, clipRight, height.toFloat())
                canvas.translate(pivotX, baseline)
                canvas.scale(scale, scale)
                canvas.translate(-pivotX, -baseline)
                paint.color = currentBaseColor()
                canvas.drawText(text, wordX, baseline, paint)
                canvas.restore()

                if (sungRight > clipLeft) {
                    canvas.save()
                    canvas.clipRect(clipLeft, 0f, sungRight, height.toFloat())
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
        text: String,
        x: Float,
        baseline: Float,
        skipRange: IntRange?,
        color: Int,
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

    private fun activeWordRange(line: LyricLine, segment: WrappedSegment): IntRange? {
        if (!style.wordScaleEnabled || !line.hasWordTiming || line.words.isEmpty()) return null
        var wordStart = 0
        for (word in line.words) {
            val wordEnd = wordStart + word.word.length
            val active = positionMs in word.startTime until word.endTime
            val overlapStart = max(segment.startChar, wordStart)
            val overlapEnd = minOf(segment.endChar, wordEnd)
            if (active && overlapStart < overlapEnd) {
                val localStart = overlapStart - segment.startChar
                val localEndExclusive = overlapEnd - segment.startChar
                return localStart until localEndExclusive
            }
            wordStart = wordEnd
        }
        return null
    }

    private fun calculateSungWidthInSegment(line: LyricLine, segment: WrappedSegment): Float {
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

    private fun beginBrowsing() {
        if (!isBrowsing) {
            browseCenterPosition = currentIndex.coerceIn(0, lines.lastIndex).toFloat()
            isBrowsing = true
        }
        notifyBrowseLineChanged()
        resetBrowseTimeout()
    }

    private fun finishBrowsing(notify: Boolean) {
        if (!isBrowsing) return
        isBrowsing = false
        isAutoReturning = false
        isDragging = false
        scroller.forceFinished(true)
        mainHandler.removeCallbacks(browseTimeoutRunnable)
        if (notify) onBrowseEnded?.invoke()
        invalidate()
    }

    private fun startAutoReturnToPlayback(notify: Boolean) {
        if (!isBrowsing) return
        if (currentIndex !in lines.indices) {
            finishBrowsing(notify)
            return
        }
        isDragging = false
        scroller.forceFinished(true)
        mainHandler.removeCallbacks(browseTimeoutRunnable)
        returnStartPosition = browseCenterPosition.coerceIn(0f, lines.lastIndex.toFloat())
        returnCenterPosition = returnStartPosition
        returnStartUptimeMs = SystemClock.uptimeMillis()
        isAutoReturning = true
        if (notify) onBrowseEnded?.invoke()
        choreographer.postFrameCallback(frameCallback)
        invalidate()
    }

    private fun resetBrowseTimeout() {
        mainHandler.removeCallbacks(browseTimeoutRunnable)
        mainHandler.postDelayed(browseTimeoutRunnable, BROWSE_TIMEOUT_MS)
    }

    private fun notifyBrowseLineChanged() {
        if (!isBrowsing || lines.isEmpty()) return
        val idx = browseCenterPosition.roundToInt().coerceIn(0, lines.lastIndex)
        if (idx != browseLineIndex) {
            browseLineIndex = idx
        }
        onBrowseLineChanged?.invoke(idx)
    }

    private fun snapBrowseCenter() {
        if (!isBrowsing || lines.isEmpty()) return
        browseCenterPosition = browseCenterPosition.roundToInt().coerceIn(0, lines.lastIndex).toFloat()
        notifyBrowseLineChanged()
        invalidate()
    }

    private fun startBrowseFling(velocityY: Float) {
        if (!isBrowsing || lines.isEmpty()) return
        val startY = (browseCenterPosition * SCROLLER_ROW_UNIT).roundToInt()
        val flingVelocity = (-velocityY / rowStride() * SCROLLER_ROW_UNIT).roundToInt()
        scroller.fling(
            0,
            startY,
            0,
            flingVelocity,
            0,
            0,
            0,
            (lines.lastIndex * SCROLLER_ROW_UNIT).roundToInt(),
        )
        choreographer.postFrameCallback(frameCallback)
    }

    private fun recycleVelocityTracker() {
        velocityTracker?.recycle()
        velocityTracker = null
    }

    private fun rowStride(): Float {
        val currentTextSize = currentTextSizePx()
        val normalTextSize = normalTextSizePx()
        return max(textHeight(currentTextSize), textHeight(normalTextSize)) + lyricRowGap()
    }

    private fun rowCenterOffset(
        index: Int,
        centerPosition: Float,
        selectedIndex: Int,
        maxTextWidth: Int,
    ): Float {
        val lower = floor(centerPosition).toInt().coerceIn(0, lines.lastIndex)
        val upper = (lower + 1).coerceAtMost(lines.lastIndex)
        val fraction = (centerPosition - lower).coerceIn(0f, 1f)
        val fromLower = rowCenterOffsetFromAnchor(index, lower, selectedIndex, maxTextWidth)
        val fromUpper = rowCenterOffsetFromAnchor(index, upper, selectedIndex, maxTextWidth)
        return fromLower + (fromUpper - fromLower) * fraction
    }

    private fun rowCenterOffsetFromAnchor(
        index: Int,
        anchor: Int,
        selectedIndex: Int,
        maxTextWidth: Int,
    ): Float {
        if (index == anchor) return 0f
        var offset = 0f
        if (index > anchor) {
            for (i in anchor until index) {
                offset += distanceBetweenRows(i, i + 1, selectedIndex, maxTextWidth)
            }
        } else {
            for (i in index until anchor) {
                offset -= distanceBetweenRows(i, i + 1, selectedIndex, maxTextWidth)
            }
        }
        return offset
    }

    private fun distanceBetweenRows(
        first: Int,
        second: Int,
        selectedIndex: Int,
        maxTextWidth: Int,
    ): Float {
        val firstHeight = rowVisualHeight(first, selectedIndex, maxTextWidth)
        val secondHeight = rowVisualHeight(second, selectedIndex, maxTextWidth)
        return (firstHeight + secondHeight) / 2f + lyricRowGap()
    }

    private fun rowVisualHeight(index: Int, selectedIndex: Int, maxTextWidth: Int): Float {
        if (index !in lines.indices) return rowStride()
        paint.textSize = if (index == selectedIndex) currentTextSizePx() else normalTextSizePx()
        val segmentCount = wrapText(lines[index].lineText, maxTextWidth).size.coerceAtLeast(1)
        val lineHeight = textHeight(paint.textSize) + wrappedLineGap()
        return lineHeight * segmentCount - wrappedLineGap()
    }

    private fun easeOutQuad(t: Float) = 1f - (1f - t) * (1f - t)

    private fun easeOutQuart(t: Float): Float {
        val v = 1f - t
        return 1f - v * v * v * v
    }

    private fun easeOutCubic(t: Float): Float {
        val v = 1f - t
        return 1f - v * v * v
    }

    private fun wrapText(text: String, maxTextWidth: Int): List<WrappedSegment> {
        if (text.isBlank() || maxTextWidth <= 0) return emptyList()
        val segments = mutableListOf<WrappedSegment>()
        var start = 0
        while (start < text.length) {
            val rawCount = paint.breakText(text, start, text.length, true, maxTextWidth.toFloat(), null)
                .coerceAtLeast(1)
            val rawEnd = (start + rawCount).coerceAtMost(text.length)
            val end = chooseWrapEnd(text, start, rawEnd).takeIf { it > start } ?: rawEnd
            segments.add(WrappedSegment(text.substring(start, end), start, end))
            start = skipLeadingWrapSeparators(text, end)
        }
        return segments
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

    private fun drawWrappedSegmentsCentered(
        segments: List<WrappedSegment>,
        centerBaseline: Float,
        drawSegment: (WrappedSegment, Float) -> Unit,
    ) {
        if (segments.isEmpty()) return
        val lineHeight = textHeight(paint.textSize) + wrappedLineGap()
        val startBaseline = centerBaseline - (segments.size - 1) * lineHeight / 2f
        segments.forEachIndexed { index, segment ->
            drawSegment(segment, startBaseline + index * lineHeight)
        }
    }

    private fun lineX(text: String, maxTextWidth: Int): Float {
        val textWidth = paint.measureText(text)
        return when (style.alignment) {
            LyricAlignment.START -> paddingLeft.toFloat()
            LyricAlignment.CENTER -> paddingLeft + (maxTextWidth - textWidth) / 2f
            LyricAlignment.END -> width - paddingRight - textWidth
        }
    }

    private fun textHeight(textSize: Float): Float {
        paint.textSize = textSize
        return paint.fontMetrics.run { descent - ascent }
    }

    private fun textCenterOffset(textSize: Float): Float {
        paint.textSize = textSize
        return (paint.ascent() + paint.descent()) / 2f
    }

    private fun currentTextSizePx() =
        sp(if (style.currentLineEnlarged) style.textSizeSp + style.currentLineEnlargedDxSp else style.textSizeSp)

    private fun normalTextSizePx() = sp(style.textSizeSp)

    private fun currentMaxTextWidth(): Int =
        (width - paddingLeft - paddingRight).coerceAtLeast(0)

    private fun wrappedLineGap() = dp(8f)

    private fun lyricRowGap() = dp(16f)

    private fun currentBaseColor() =
        Color.argb(
            255,
            Color.red(style.normalColorArgb),
            Color.green(style.normalColorArgb),
            Color.blue(style.normalColorArgb),
        )

    private fun dp(value: Float) = value * resources.displayMetrics.density
    private fun sp(value: Float) = value * resources.displayMetrics.scaledDensity

    private companion object {
        private const val BROWSE_TIMEOUT_MS = 3_000L
        private const val RETURN_ANIM_DURATION_MS = 520L
        private const val SCROLLER_ROW_UNIT = 1000f
        private const val WRAP_BOUNDARY_CHARS = "，。！？、；：,.!?;:)]）】》"
    }

    private data class WrappedSegment(
        val text: String,
        val startChar: Int,
        val endChar: Int,
    )
}
