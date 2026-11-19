package cn.partialy.pm.ui.player

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.os.SystemClock
import android.text.TextPaint
import android.util.AttributeSet
import android.view.Choreographer
import android.view.MotionEvent
import android.view.View
import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.ui.player.lyricstyle.KaraokeBrowseController
import cn.partialy.pm.ui.player.lyricstyle.KaraokeLyricLayoutEngine
import cn.partialy.pm.ui.player.lyricstyle.LyricEffectConfig
import cn.partialy.pm.ui.player.lyricstyle.LyricEffectRenderFrame
import cn.partialy.pm.ui.player.lyricstyle.LyricEffectRendererRegistry
import cn.partialy.pm.ui.player.lyricstyle.LyricFrameRateLimiter
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * 完整歌词页原生 Canvas 视图：
 * 负责 Choreographer 限帧调度与生命周期管理，
 * 折行字素布局、手动浏览回弹与 7 款样式绘制分别委托给 lyricstyle 模块。
 */
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
    private val layoutEngine = KaraokeLyricLayoutEngine()
    private val renderers = LyricEffectRendererRegistry(layoutEngine)
    private val frameLimiter = LyricFrameRateLimiter()

    private val choreographer: Choreographer = Choreographer.getInstance()
    private var frameScheduled = false
    private lateinit var frameCallback: Choreographer.FrameCallback

    private var lines: List<LyricLine> = emptyList()
    private var currentIndex: Int = -1
    private var style: LyricDisplayStyle = LyricDisplayStyle.DEFAULT
    private var effectConfig: LyricEffectConfig = LyricEffectConfig.DEFAULT
    private var useWordTiming: Boolean = true

    private var anchorPositionMs: Long = 0L
    private var anchorUptimeMs: Long = 0L
    private var isPlaying: Boolean = false
    private var renderingActive = true
    private var positionMs: Long = 0L

    private var prevCurrentIndex: Int = -1
    private var lineAnimStartUptimeMs: Long = 0L
    private var lineAnimDurationMs: Long = 380L
    private var lineAnimProgress: Float = 1f

    private var scaleAnimProgress: Float = 1f
    private var scaleAnimStartUptimeMs: Long = 0L
    private val scaleAnimDurationMs = 300L

    private val browseController = KaraokeBrowseController(
        context = context,
        requestDisallowIntercept = { disallow -> parent?.requestDisallowInterceptTouchEvent(disallow) },
        requestFrame = { ensureFrameScheduled() },
        requestInvalidate = { invalidate() },
        performClickAction = { performClick() },
        getLineCount = { lines.size },
        getCurrentIndex = { currentIndex },
        getRowStride = { rowStride() },
        onBrowseLineChanged = { idx -> onBrowseLineChanged?.invoke(idx) },
        onBrowseEnded = { onBrowseEnded?.invoke() },
    )

    init {
        isClickable = true
        frameCallback = Choreographer.FrameCallback { frameTimeNanos ->
            frameScheduled = false
            if (!renderingActive || !isShown || windowVisibility != VISIBLE) return@FrameCallback
            val frameUptimeMs = frameTimeNanos / 1_000_000L
            var needNextFrame = false
            var stateFinishedThisFrame = false

            if (isPlaying && lines.isNotEmpty() && currentIndex in lines.indices) {
                positionMs = anchorPositionMs + (frameUptimeMs - anchorUptimeMs).coerceAtLeast(0L)
                needNextFrame = true
            }

            if (lineAnimProgress < 1f) {
                val elapsed = frameUptimeMs - lineAnimStartUptimeMs
                lineAnimProgress = (elapsed.toFloat() / lineAnimDurationMs).coerceIn(0f, 1f)
                if (lineAnimProgress < 1f) needNextFrame = true else stateFinishedThisFrame = true
            }

            if (scaleAnimProgress < 1f) {
                val elapsed = frameUptimeMs - scaleAnimStartUptimeMs
                scaleAnimProgress = (elapsed.toFloat() / scaleAnimDurationMs).coerceIn(0f, 1f)
                if (scaleAnimProgress < 1f) needNextFrame = true else stateFinishedThisFrame = true
            }

            if (browseController.stepAnimation(frameUptimeMs)) {
                needNextFrame = true
            }

            if (stateFinishedThisFrame || (needNextFrame && frameLimiter.shouldDrawNanos(frameTimeNanos))) {
                invalidate()
            }
            if (needNextFrame) {
                ensureFrameScheduled()
            }
        }
    }

    /** 保留浏览状态与三秒恢复计时，仅暂停屏幕帧调度。 */
    fun setRenderingActive(active: Boolean) {
        renderingActive = active
        cancelFrame()
        if (active && isShown && windowVisibility == VISIBLE) {
            anchorUptimeMs = SystemClock.uptimeMillis()
            frameLimiter.reset()
            ensureFrameScheduled()
        }
    }

    val browsedLineIndex: Int
        get() = browseController.browsedLineIndex

    /** 更换歌词数据前清理上一首的行号与位移动画，不继承跨歌曲过渡。 */
    fun resetContent() {
        stopAnimations()
        layoutEngine.clearCache()
        renderers.releaseAll()
        lines = emptyList()
        currentIndex = -1
        prevCurrentIndex = -1
        invalidate()
    }

    fun resumeAutoScroll() {
        browseController.finishBrowsing(notify = true)
    }

    fun bind(
        lines: List<LyricLine>,
        currentIndex: Int,
        positionMs: Long,
        isPlaying: Boolean = true,
        style: LyricDisplayStyle,
        animateTransitions: Boolean = true,
        effectConfig: LyricEffectConfig = this.effectConfig,
        useWordTiming: Boolean = true,
    ) {
        val normalizedEffect = effectConfig.normalized()
        val linesChanged = this.lines !== lines
        val styleChanged = this.style != style
        val effectChanged = this.effectConfig != normalizedEffect
        val wordModeChanged = this.useWordTiming != useWordTiming
        val oldSize = this.style.textSizeSp

        if (linesChanged || styleChanged || effectChanged) {
            layoutEngine.clearCache()
        }
        if (effectChanged) {
            frameLimiter.setTargetFps(normalizedEffect.fps)
        }

        this.lines = lines
        this.style = style
        this.effectConfig = normalizedEffect
        this.useWordTiming = useWordTiming

        val lineChanged = currentIndex != this.currentIndex
        if (lineChanged) {
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
        val nowUptime = SystemClock.uptimeMillis()
        val predicted = if (wasPlaying) anchorPositionMs + (nowUptime - anchorUptimeMs).coerceAtLeast(0L) else this.positionMs
        val jumped = abs(predicted - positionMs) > POSITION_RESYNC_THRESHOLD_MS

        anchorPositionMs = positionMs
        anchorUptimeMs = nowUptime
        this.positionMs = positionMs

        browseController.onLinesUpdated()

        if (oldSize != style.textSizeSp) requestLayout()

        if (!animateTransitions) {
            stopAnimations()
            return
        }

        val shouldAnimate = renderingActive && (
            isPlaying ||
                lineAnimProgress < 1f ||
                scaleAnimProgress < 1f ||
                browseController.hasActiveAnimation
            )

        if (shouldAnimate) {
            if (!wasPlaying || effectChanged) {
                frameLimiter.reset()
            }
            ensureFrameScheduled()
        } else {
            cancelFrame()
        }

        // 播放中常规 100ms 校准不额外打断 Choreographer 限帧节奏，仅在关键状态变化或暂停时立即重绘。
        if (!isPlaying || !wasPlaying || linesChanged || lineChanged || styleChanged || effectChanged || wordModeChanged || jumped) {
            invalidate()
        }
    }

    /** 供独立预览暂停或静态展示使用，不触发浏览返回动画。 */
    fun stopAnimations() {
        isPlaying = false
        lineAnimProgress = 1f
        scaleAnimProgress = 1f
        prevCurrentIndex = currentIndex
        browseController.stopAll()
        cancelFrame()
        invalidate()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (lines.isEmpty()) return super.onTouchEvent(event)
        return browseController.onTouchEvent(event) || super.onTouchEvent(event)
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (renderingActive && visibility == VISIBLE && (isPlaying || browseController.hasActiveAnimation)) {
            anchorUptimeMs = SystemClock.uptimeMillis()
            frameLimiter.reset()
            ensureFrameScheduled()
        } else {
            cancelFrame()
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cancelFrame()
        browseController.onDetached()
        layoutEngine.clearCache()
        renderers.releaseAll()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (lines.isEmpty() || currentIndex !in lines.indices) return
        val maxTextWidth = currentMaxTextWidth()
        if (maxTextWidth <= 0) return

        val currentTextSize = currentTextSizePx()
        val normalTextSize = normalTextSizePx()
        val rowStride = rowStride()
        val centerBaseline = height / 2f - layoutEngine.textCenterOffset(paint, currentTextSize)
        val renderer = renderers.get(effectConfig.styleId)
        val selectedExtraPadding = renderer.extraVerticalPaddingPx(
            config = effectConfig,
            textSizePx = currentTextSize,
            density = resources.displayMetrics.density,
        )

        val scrollT = easeOutQuart(lineAnimProgress)
        val scrollOffset = if (!browseController.isBrowsing && lineAnimProgress < 1f && prevCurrentIndex >= 0) {
            (currentIndex - prevCurrentIndex) * (1f - scrollT)
        } else {
            0f
        }

        val centerPosition = when {
            browseController.isAutoReturning -> browseController.returnCenterPosition
            browseController.isBrowsing -> browseController.browseCenterPosition
            else -> currentIndex - scrollOffset
        }.coerceIn(0f, lines.lastIndex.toFloat())

        val selectedIndex = if (browseController.isBrowsing && !browseController.isAutoReturning) {
            browseController.browseCenterPosition.roundToInt().coerceIn(0, lines.lastIndex)
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
            paint.shader = null
            paint.clearShadowLayer()

            val baseline = centerBaseline + layoutEngine.rowCenterOffset(
                paint = paint,
                lines = lines,
                index = index,
                centerPosition = centerPosition,
                selectedIndex = selectedIndex,
                maxTextWidth = maxTextWidth,
                currentTextSize = currentTextSize,
                normalTextSize = normalTextSize,
                wrappedLineGapPx = wrappedLineGap(),
                lyricRowGapPx = lyricRowGap(),
                selectedExtraVerticalPaddingPx = selectedExtraPadding,
            )
            if (baseline < -rowStride * 2f || baseline > height + rowStride * 2f) continue

            if (isSelected) {
                val line = lines[index]
                val showProgress = !browseController.isBrowsing || index == currentIndex
                val lineEndMs = layoutEngine.resolveLineEndTimeMs(lines, index)
                val lineDurationMs = max(1L, lineEndMs - line.startTime)
                val elapsedMs = max(0L, positionMs - line.startTime)
                val wordMode = useWordTiming && line.hasWordTiming

                paint.textSize = currentTextSize
                paint.isFakeBoldText = style.currentLineBold
                val layout = layoutEngine.buildCurrentLineEffectLayout(
                    paint = paint,
                    line = line,
                    lineEndMs = lineEndMs,
                    centerBaseline = baseline,
                    maxTextWidth = maxTextWidth,
                    viewWidth = width,
                    paddingLeft = paddingLeft,
                    paddingRight = paddingRight,
                    wrappedLineGapPx = wrappedLineGap(),
                    alignment = style.alignment,
                )
                val frame = LyricEffectRenderFrame(
                    line = line,
                    layout = layout,
                    paint = paint,
                    displayStyle = style,
                    effectConfig = effectConfig,
                    positionMs = positionMs,
                    elapsedMs = elapsedMs,
                    durationMs = lineDurationMs,
                    wordMode = wordMode,
                    showProgress = showProgress,
                    centerBaseline = baseline,
                    maxTextWidth = maxTextWidth,
                    viewWidth = width,
                    viewHeight = height,
                    paddingLeft = paddingLeft,
                    paddingRight = paddingRight,
                    wrappedLineGapPx = wrappedLineGap(),
                    density = resources.displayMetrics.density,
                )

                if (!browseController.isBrowsing && scaleAnimProgress < 1f) {
                    val scale = 0.93f + 0.07f * easeOutQuad(scaleAnimProgress)
                    canvas.save()
                    canvas.translate(width / 2f, baseline)
                    canvas.scale(scale, scale)
                    canvas.translate(-width / 2f, -baseline)
                    renderer.drawCurrentLine(canvas, frame)
                    canvas.restore()
                } else {
                    renderer.drawCurrentLine(canvas, frame)
                }
            } else {
                drawNormalLine(canvas, lines[index], baseline, maxTextWidth)
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
        paint.isFakeBoldText = false
        paint.shader = null
        paint.clearShadowLayer()
        paint.color = style.resolvedNormalColor()
        val segments = layoutEngine.wrapText(paint, line.lineText, maxTextWidth)
        layoutEngine.drawWrappedSegmentsCentered(
            paint = paint,
            segments = segments,
            centerBaseline = baseline,
            wrappedLineGapPx = wrappedLineGap(),
        ) { segment, segmentBaseline ->
            val x = layoutEngine.lineX(
                paint = paint,
                text = segment.text,
                maxTextWidth = maxTextWidth,
                viewWidth = width,
                paddingLeft = paddingLeft,
                paddingRight = paddingRight,
                alignment = style.alignment,
            )
            canvas.drawText(segment.text, x, segmentBaseline, paint)
        }
    }

    private fun ensureFrameScheduled() {
        if (frameScheduled || !renderingActive || !isShown || windowVisibility != VISIBLE) return
        frameScheduled = true
        choreographer.postFrameCallback(frameCallback)
    }

    private fun cancelFrame() {
        if (!frameScheduled) return
        choreographer.removeFrameCallback(frameCallback)
        frameScheduled = false
    }

    private fun rowStride(): Float = layoutEngine.rowStride(
        paint = paint,
        currentTextSize = currentTextSizePx(),
        normalTextSize = normalTextSizePx(),
        lyricRowGapPx = lyricRowGap(),
    )

    private fun easeOutQuad(t: Float) = 1f - (1f - t) * (1f - t)

    private fun easeOutQuart(t: Float): Float {
        val v = 1f - t
        return 1f - v * v * v * v
    }

    private fun currentTextSizePx() =
        sp(if (style.currentLineEnlarged) style.textSizeSp + style.currentLineEnlargedDxSp else style.textSizeSp)

    private fun normalTextSizePx() = sp(style.textSizeSp)

    private fun currentMaxTextWidth(): Int = (width - paddingLeft - paddingRight).coerceAtLeast(0)

    private fun wrappedLineGap() = dp(8f)

    private fun lyricRowGap() = dp(16f)

    private fun dp(value: Float) = value * resources.displayMetrics.density

    private fun sp(value: Float) = value * resources.displayMetrics.scaledDensity

    private companion object {
        const val POSITION_RESYNC_THRESHOLD_MS = 180L
    }
}
