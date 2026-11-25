package cn.partialy.pm.ui.player

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
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
import cn.partialy.pm.ui.player.lyricstyle.LyricCascadeScrollController
import cn.partialy.pm.ui.player.lyricstyle.LyricEffectConfig
import cn.partialy.pm.ui.player.lyricstyle.LyricEffectRenderFrame
import cn.partialy.pm.ui.player.lyricstyle.LyricEffectRendererRegistry
import cn.partialy.pm.ui.player.lyricstyle.LyricEffectStyleId
import cn.partialy.pm.ui.player.lyricstyle.LyricFrameRateLimiter
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * 完整歌词页原生 Canvas 视图：
 * 负责 Choreographer 限帧调度与生命周期管理，
 * 折行字素布局、手动浏览回弹、AMLyric 级联弹簧滚动与 7 款样式绘制分别委托给 lyricstyle 模块。
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

    private val cascadeScroll = LyricCascadeScrollController()
    private var lastFrameUptimeMs: Long = 0L
    private var wasBrowsing: Boolean = false

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
            val dtMs = if (lastFrameUptimeMs > 0L) {
                (frameUptimeMs - lastFrameUptimeMs).coerceIn(1L, 32L).toFloat()
            } else {
                16f
            }
            lastFrameUptimeMs = frameUptimeMs
            var needNextFrame = false
            var stateFinishedThisFrame = false

            if (isPlaying && lines.isNotEmpty() && currentIndex in lines.indices) {
                positionMs = anchorPositionMs + (frameUptimeMs - anchorUptimeMs).coerceAtLeast(0L)
                needNextFrame = true
            }

            if (browseController.isBrowsing) {
                if (browseController.stepAnimation(frameUptimeMs)) {
                    needNextFrame = true
                }
                if (!browseController.isBrowsing) {
                    cascadeScroll.snapTo(currentIndex)
                    stateFinishedThisFrame = true
                }
            } else {
                if (wasBrowsing) {
                    cascadeScroll.snapTo(currentIndex)
                    stateFinishedThisFrame = true
                }
                val wasCascadeActive = cascadeScroll.hasActiveAnimation
                if (cascadeScroll.step(dtMs)) {
                    needNextFrame = true
                } else if (wasCascadeActive) {
                    stateFinishedThisFrame = true
                }
            }
            wasBrowsing = browseController.isBrowsing

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
            val nowUptime = SystemClock.uptimeMillis()
            anchorUptimeMs = nowUptime
            lastFrameUptimeMs = nowUptime
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
        cascadeScroll.reset(-1)
        invalidate()
    }

    fun resumeAutoScroll() {
        browseController.finishBrowsing(notify = true)
        cascadeScroll.snapTo(currentIndex)
        invalidate()
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

        if (linesChanged) {
            cascadeScroll.reset(-1)
        }

        val lineChanged = currentIndex != this.currentIndex
        this.currentIndex = currentIndex

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

        val animAllowed = animateTransitions && ValueAnimator.areAnimatorsEnabled()
        if (currentIndex in lines.indices) {
            val radius = estimatedVisibleRadius()
            cascadeScroll.updateTarget(
                nextCurrentIndex = currentIndex,
                nextSelectedIndex = currentIndex,
                animate = animAllowed && !browseController.isBrowsing,
                visibleStart = (currentIndex - radius).coerceAtLeast(0),
                visibleEnd = (currentIndex + radius).coerceAtMost(lines.lastIndex),
            )
        } else {
            cascadeScroll.reset(-1)
        }

        if (!animAllowed) {
            stopAnimations()
            return
        }

        val shouldAnimate = renderingActive && (
            isPlaying ||
                cascadeScroll.hasActiveAnimation ||
                browseController.hasActiveAnimation
            )

        if (shouldAnimate) {
            if (!wasPlaying || effectChanged) {
                frameLimiter.reset()
            }
            if (!frameScheduled) {
                lastFrameUptimeMs = nowUptime
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
        cascadeScroll.snapTo(currentIndex)
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
        if (renderingActive && visibility == VISIBLE && (isPlaying || cascadeScroll.hasActiveAnimation || browseController.hasActiveAnimation)) {
            val nowUptime = SystemClock.uptimeMillis()
            anchorUptimeMs = nowUptime
            lastFrameUptimeMs = nowUptime
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

        val isBrowsingMode = browseController.isBrowsing
        val browseCenterPos = when {
            browseController.isAutoReturning -> browseController.returnCenterPosition
            browseController.isBrowsing -> browseController.browseCenterPosition
            else -> currentIndex.toFloat()
        }.coerceIn(0f, lines.lastIndex.toFloat())

        val selectedIndex = if (isBrowsingMode && !browseController.isAutoReturning) {
            browseController.browseCenterPosition.roundToInt().coerceIn(0, lines.lastIndex)
        } else {
            currentIndex
        }

        val windowAnchor = if (isBrowsingMode) browseCenterPos else currentIndex.toFloat()
        val visibleRadius = estimatedVisibleRadius() + 2
        val first = floor(windowAnchor - visibleRadius).toInt().coerceAtLeast(0)
        val last = floor(windowAnchor + visibleRadius).toInt().coerceAtMost(lines.lastIndex)
        val pivotX = alignmentPivotX()

        for (index in first..last) {
            val isSelected = index == selectedIndex
            val lineCenterPos = if (isBrowsingMode) {
                browseCenterPos
            } else {
                cascadeScroll.scrollPositionForLine(index, currentIndex).coerceIn(0f, lines.lastIndex.toFloat())
            }
            val emphasis = if (isBrowsingMode) {
                if (isSelected) 1f else 0f
            } else {
                cascadeScroll.emphasisForLine(index, selectedIndex)
            }

            paint.textSize = if (isSelected) currentTextSize else normalTextSize
            paint.isFakeBoldText = isSelected && style.currentLineBold
            paint.shader = null
            paint.clearShadowLayer()

            val baseline = centerBaseline + layoutEngine.rowCenterOffset(
                paint = paint,
                lines = lines,
                index = index,
                centerPosition = lineCenterPos,
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
                val showProgress = !isBrowsingMode || index == currentIndex
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

                val minScale = if (currentTextSize > 0f) normalTextSize / currentTextSize else 1f
                val scale = minScale + (1f - minScale) * emphasis
                if (!isBrowsingMode && abs(scale - 1f) > 0.002f) {
                    canvas.save()
                    canvas.scale(scale, scale, pivotX, baseline)
                    renderer.drawCurrentLine(canvas, frame)
                    canvas.restore()
                } else {
                    renderer.drawCurrentLine(canvas, frame)
                }
            } else {
                drawNormalLine(
                    canvas = canvas,
                    line = lines[index],
                    baseline = baseline,
                    maxTextWidth = maxTextWidth,
                    emphasis = emphasis,
                    currentTextSize = currentTextSize,
                    normalTextSize = normalTextSize,
                    pivotX = pivotX,
                )
            }
        }
    }

    private fun drawNormalLine(
        canvas: Canvas,
        line: LyricLine,
        baseline: Float,
        maxTextWidth: Int,
        emphasis: Float,
        currentTextSize: Float,
        normalTextSize: Float,
        pivotX: Float,
    ) {
        val clampedEmphasis = emphasis.coerceIn(0f, 1f)
        paint.textSize = normalTextSize
        paint.isFakeBoldText = style.currentLineBold && clampedEmphasis >= 0.5f
        paint.shader = null
        paint.clearShadowLayer()
        val normalColor = style.resolvedNormalColor()
        paint.color = if (clampedEmphasis > 0.002f) {
            blendArgb(normalColor, resolveEmphasisColor(), clampedEmphasis)
        } else {
            normalColor
        }
        val segments = layoutEngine.wrapText(paint, line.lineText, maxTextWidth)
        val maxScale = if (normalTextSize > 0f) currentTextSize / normalTextSize else 1f
        val scale = 1f + (maxScale - 1f) * emphasis.coerceAtLeast(0f)
        val needScale = abs(scale - 1f) > 0.002f
        if (needScale) {
            canvas.save()
            canvas.scale(scale, scale, pivotX, baseline)
        }
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
        if (needScale) {
            canvas.restore()
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

    private fun estimatedVisibleRadius(): Int {
        if (height <= 0) return 6
        val stride = rowStride().coerceAtLeast(1f)
        return max(2, (height / stride).roundToInt() / 2 + 2)
    }

    private fun alignmentPivotX(): Float = when (style.alignment) {
        LyricAlignment.START -> paddingLeft.toFloat()
        LyricAlignment.CENTER -> width / 2f
        LyricAlignment.END -> (width - paddingRight).toFloat()
    }

    private fun resolveEmphasisColor(): Int = when (effectConfig.styleId) {
        LyricEffectStyleId.DEFAULT, LyricEffectStyleId.ACCOMPANIST -> style.currentColorArgb
        LyricEffectStyleId.TYPEWRITER -> effectConfig.typewriter.textColorArgb
        LyricEffectStyleId.INK -> effectConfig.ink.highlightStartColorArgb
        LyricEffectStyleId.BOUNCE -> effectConfig.bounce.sungColorArgb
        LyricEffectStyleId.SPOTLIGHT -> effectConfig.spotlight.sungColorArgb
        LyricEffectStyleId.NEON -> effectConfig.neon.colorMidArgb
        LyricEffectStyleId.OCEAN -> effectConfig.ocean.sungColorArgb
    }

    private fun blendArgb(from: Int, to: Int, fraction: Float): Int {
        val p = fraction.coerceIn(0f, 1f)
        val a = (Color.alpha(from) + (Color.alpha(to) - Color.alpha(from)) * p).roundToInt().coerceIn(0, 255)
        val r = (Color.red(from) + (Color.red(to) - Color.red(from)) * p).roundToInt().coerceIn(0, 255)
        val g = (Color.green(from) + (Color.green(to) - Color.green(from)) * p).roundToInt().coerceIn(0, 255)
        val b = (Color.blue(from) + (Color.blue(to) - Color.blue(from)) * p).roundToInt().coerceIn(0, 255)
        return Color.argb(a, r, g, b)
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
