package cn.partialy.pm.ui.player

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import android.os.SystemClock
import android.text.TextPaint
import android.text.TextUtils
import android.util.AttributeSet
import android.view.Choreographer
import android.view.View
import cn.partialy.pm.lyric.LyricContent
import cn.partialy.pm.lyric.LyricLine
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * 封面三行歌词：媒体位置由 Activity 校准，Choreographer 在可见时逐帧插值。
 * 不自行读取播放器；离开封面页或宿主停止立即取消帧回调。
 */
class CompactLyricsView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {
    private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG)
    private val maskPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
    }
    private val choreographer = Choreographer.getInstance()
    private var framePosted = false
    private var renderingActive = false
    private var playing = false
    private var lines: List<LyricLine> = emptyList()
    private var currentIndex = -1
    private var previousIndex = -1
    private var positionMs = 0L
    private var anchorPositionMs = 0L
    private var anchorUptimeMs = 0L
    private var style = LyricDisplayStyle.DEFAULT
    private var animate = true
    private var useWordTiming = true
    private var lineTransitionStartMs = 0L
    private var lineTransitionDurationMs = 380L
    private var lineTransitionProgress = 1f
    private var fadeShader: Shader? = null
    private var fadeLeft = Float.NaN
    private var fadeRight = Float.NaN

    private val frameCallback = Choreographer.FrameCallback { frameTimeNanos ->
        framePosted = false
        if (!canRenderFrames() || !playing) return@FrameCallback
        val nowMs = frameTimeNanos / 1_000_000L
        if (playing) {
            positionMs = anchorPositionMs + (nowMs - anchorUptimeMs).coerceAtLeast(0L)
            updateCurrentIndex(CompactLyricRules.currentIndex(lines, positionMs), nowMs, true)
        }
        if (lineTransitionProgress < 1f) {
            lineTransitionProgress = ((nowMs - lineTransitionStartMs).toFloat() /
                lineTransitionDurationMs).coerceIn(0f, 1f)
            if (lineTransitionProgress >= 1f) previousIndex = currentIndex
        }
        postInvalidateOnAnimation()
        scheduleFrame()
    }

    fun bind(
        content: LyricContent,
        positionMs: Long,
        isPlaying: Boolean,
        style: LyricDisplayStyle,
        animateTransitions: Boolean = true,
        useWordTiming: Boolean = true,
    ) = bind(
        content.displayLines,
        CompactLyricRules.currentIndex(content.displayLines, positionMs),
        positionMs, isPlaying, style, animateTransitions, useWordTiming,
    )

    fun bind(
        lines: List<LyricLine>,
        currentIndex: Int,
        positionMs: Long,
        isPlaying: Boolean,
        style: LyricDisplayStyle,
        animateTransitions: Boolean = true,
        useWordTiming: Boolean = true,
    ) {
        val nowMs = SystemClock.uptimeMillis()
        val contentChanged = this.lines !== lines
        val wasPlaying = playing
        val predictedPosition = if (wasPlaying) {
            anchorPositionMs + (nowMs - anchorUptimeMs).coerceAtLeast(0L)
        } else this.positionMs
        val jumped = abs(predictedPosition - positionMs) > POSITION_RESYNC_THRESHOLD_MS
        val sizeChanged = this.style.textSizeSp != style.textSizeSp ||
            this.style.currentLineEnlargedDxSp != style.currentLineEnlargedDxSp ||
            this.style.currentLineEnlarged != style.currentLineEnlarged
        this.lines = lines
        this.style = style
        this.animate = animateTransitions
        this.useWordTiming = useWordTiming
        this.playing = isPlaying
        if (contentChanged || !wasPlaying || !isPlaying || jumped) {
            anchorPositionMs = positionMs
            anchorUptimeMs = nowMs
            this.positionMs = positionMs
        }
        if (contentChanged) {
            this.currentIndex = currentIndex
            previousIndex = currentIndex
            lineTransitionProgress = 1f
        } else {
            updateCurrentIndex(currentIndex, nowMs,
                isPlaying && !jumped && animateTransitions && renderingActive)
        }
        if (!wasPlaying && isPlaying && lineTransitionProgress < 1f) {
            lineTransitionStartMs = nowMs -
                (lineTransitionProgress * lineTransitionDurationMs).toLong()
        }
        contentDescription = lines.getOrNull(this.currentIndex)?.lineText.orEmpty()
        if (sizeChanged) requestLayout()
        invalidate()
        scheduleFrame()
    }

    fun setRenderingActive(active: Boolean) {
        if (renderingActive == active) return
        renderingActive = active
        if (!active) {
            if (playing) positionMs = anchorPositionMs +
                (SystemClock.uptimeMillis() - anchorUptimeMs).coerceAtLeast(0L)
            removeFrame()
        } else {
            anchorPositionMs = positionMs
            anchorUptimeMs = SystemClock.uptimeMillis()
            scheduleFrame()
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        scheduleFrame()
    }

    override fun onDetachedFromWindow() {
        removeFrame()
        super.onDetachedFromWindow()
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (visibility == VISIBLE) scheduleFrame() else removeFrame()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        if (visibility == VISIBLE) scheduleFrame() else removeFrame()
    }

    private fun canRenderFrames(): Boolean =
        renderingActive && isShown && windowVisibility == VISIBLE &&
            animate && ValueAnimator.areAnimatorsEnabled() && lines.isNotEmpty()

    private fun scheduleFrame() {
        if (!framePosted && canRenderFrames() && playing) {
            framePosted = true
            choreographer.postFrameCallback(frameCallback)
        }
    }

    private fun removeFrame() {
        if (framePosted) {
            choreographer.removeFrameCallback(frameCallback)
            framePosted = false
        }
    }

    private fun updateCurrentIndex(nextIndex: Int, nowMs: Long, allowTransition: Boolean) {
        if (nextIndex == currentIndex) return
        val difference = abs(nextIndex - currentIndex)
        val smooth = allowTransition && currentIndex >= 0 && nextIndex >= 0 &&
            difference in 1..3 && ValueAnimator.areAnimatorsEnabled()
        previousIndex = if (smooth) currentIndex else nextIndex
        currentIndex = nextIndex
        lineTransitionDurationMs = when (difference) {
            1 -> 380L
            2, 3 -> 280L
            else -> 180L
        }
        lineTransitionStartMs = nowMs
        lineTransitionProgress = if (smooth) 0f else 1f
        contentDescription = lines.getOrNull(nextIndex)?.lineText.orEmpty()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        paint.textSize = currentSize()
        val row = paint.fontMetrics.run { descent - ascent } + dp(10f)
        setMeasuredDimension(
            resolveSize(suggestedMinimumWidth, widthMeasureSpec),
            resolveSize((row * 3 + paddingTop + paddingBottom).toInt(), heightMeasureSpec),
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val available = (width - paddingLeft - paddingRight).toFloat()
        if (available <= 0 || currentIndex !in lines.indices) return
        val row = (height - paddingTop - paddingBottom) / 3f
        val progress = if (animate && ValueAnimator.areAnimatorsEnabled()) {
            easeOutCubic(lineTransitionProgress)
        } else 1f
        val visualIndex = if (previousIndex >= 0) {
            previousIndex + (currentIndex - previousIndex) * progress
        } else currentIndex.toFloat()
        val first = (floor(visualIndex).toInt() - 2).coerceAtLeast(0)
        val last = (floor(visualIndex).toInt() + 3).coerceAtMost(lines.lastIndex)
        val normalColor = style.resolvedNormalColor()

        for (index in first..last) {
            val distance = index - visualIndex
            val absDistance = abs(distance)
            if (absDistance >= 1.7f) continue
            val rowAlpha = if (absDistance <= 1f) 1f
                else ((1.7f - absDistance) / 0.7f).coerceIn(0f, 1f)
            val emphasis = (1f - absDistance).coerceIn(0f, 1f)
            val line = lines[index]
            val selected = index == currentIndex
            paint.textSize = sp(style.textSizeSp +
                if (style.currentLineEnlarged) style.currentLineEnlargedDxSp * emphasis else 0f)
            paint.isFakeBoldText = style.currentLineBold && emphasis >= .5f
            val text = if (selected) line.lineText else
                TextUtils.ellipsize(line.lineText, paint, available, TextUtils.TruncateAt.END).toString()
            val centerY = paddingTop + (distance + 1.5f) * row
            val baseline = centerY - (paint.ascent() + paint.descent()) / 2f
            val textWidth = paint.measureText(text)
            val overflow = (textWidth - available).coerceAtLeast(0f)
            val origin = if (overflow > 0f) paddingLeft.toFloat()
                else if (selected) paddingLeft + (available - textWidth) / 2f
                else when (style.alignment) {
                    LyricAlignment.START -> paddingLeft.toFloat()
                    LyricAlignment.CENTER -> paddingLeft + (available - textWidth) / 2f
                    LyricAlignment.END -> width - paddingRight - textWidth
                }
            val offset = if (selected && overflow > 0f && animate &&
                ValueAnimator.areAnimatorsEnabled()) {
                val end = lines.getOrNull(index + 1)?.startTime
                    ?.takeIf { it > line.startTime } ?: line.endTime
                CompactLyricRules.horizontalOffset(
                    overflow, resources.displayMetrics.density,
                    positionMs - line.startTime, end - line.startTime,
                )
            } else 0f
            val x = origin - offset
            val layer = if (selected && overflow > 0f) {
                canvas.saveLayer(
                    paddingLeft.toFloat(), 0f,
                    (width - paddingRight).toFloat(), height.toFloat(), null,
                )
            } else canvas.save()
            canvas.clipRect(paddingLeft.toFloat(), 0f, (width - paddingRight).toFloat(), height.toFloat())
            val baseColor = if (useWordTiming && line.hasWordTiming)
                style.normalColorArgb else style.currentColorArgb
            paint.color = withAlpha(blendColor(normalColor, baseColor, emphasis), rowAlpha)
            drawLine(canvas, line, text, x, baseline, selected)
            if (selected && useWordTiming && line.hasWordTiming) {
                val sung = line.words.sumOf {
                    (paint.measureText(it.word) * CompactLyricRules.wordProgress(it, positionMs)).toDouble()
                }.toFloat()
                canvas.save()
                canvas.clipRect(x, 0f, x + sung, height.toFloat())
                paint.color = withAlpha(style.currentColorArgb, rowAlpha)
                drawLine(canvas, line, text, x, baseline, true)
                canvas.restore()
            }
            if (selected && overflow > 0f) {
                ensureFadeShader(available)
                maskPaint.shader = fadeShader
                canvas.drawRect(
                    paddingLeft.toFloat(), 0f,
                    (width - paddingRight).toFloat(), height.toFloat(), maskPaint,
                )
            }
            canvas.restoreToCount(layer)
        }
    }

    private fun drawLine(
        canvas: Canvas, line: LyricLine, text: String,
        x: Float, baseline: Float, selected: Boolean,
    ) {
        if (!selected || !useWordTiming || !style.wordScaleEnabled ||
            !line.hasWordTiming || !animate || !ValueAnimator.areAnimatorsEnabled()) {
            canvas.drawText(text, x, baseline, paint)
            return
        }
        var cursor = x
        line.words.forEach { word ->
            val wordWidth = paint.measureText(word.word)
            val active = positionMs >= word.startTime && positionMs < word.endTime
            canvas.save()
            if (active) {
                val scale = 1f + .14f * sin(
                    CompactLyricRules.wordProgress(word, positionMs) * PI,
                ).toFloat()
                canvas.scale(scale, scale, cursor + wordWidth / 2f, baseline)
            }
            canvas.drawText(word.word, cursor, baseline, paint)
            canvas.restore()
            cursor += wordWidth
        }
    }

    private fun ensureFadeShader(available: Float) {
        val left = paddingLeft.toFloat()
        val right = width - paddingRight.toFloat()
        if (fadeShader != null && fadeLeft == left && fadeRight == right) return
        val fade = dp(16f).coerceAtMost(available / 2f)
        fadeShader = LinearGradient(
            left, 0f, right, 0f,
            intArrayOf(Color.TRANSPARENT, Color.BLACK, Color.BLACK, Color.TRANSPARENT),
            floatArrayOf(0f, fade / available, 1f - fade / available, 1f),
            Shader.TileMode.CLAMP,
        )
        fadeLeft = left
        fadeRight = right
    }

    private fun blendColor(from: Int, to: Int, fraction: Float): Int {
        val p = fraction.coerceIn(0f, 1f)
        fun channel(a: Int, b: Int) = (a + (b - a) * p).roundToInt()
        return Color.argb(
            channel(Color.alpha(from), Color.alpha(to)),
            channel(Color.red(from), Color.red(to)),
            channel(Color.green(from), Color.green(to)),
            channel(Color.blue(from), Color.blue(to)),
        )
    }

    private fun withAlpha(color: Int, factor: Float): Int =
        Color.argb((Color.alpha(color) * factor).roundToInt().coerceIn(0, 255),
            Color.red(color), Color.green(color), Color.blue(color))

    private fun currentSize() = sp(style.textSizeSp +
        if (style.currentLineEnlarged) style.currentLineEnlargedDxSp else 0)
    private fun easeOutCubic(p: Float): Float {
        val t = 1f - p
        return 1f - t * t * t
    }
    private fun dp(value: Float) = value * resources.displayMetrics.density
    private fun sp(value: Float) = value * resources.displayMetrics.scaledDensity

    private companion object {
        private const val POSITION_RESYNC_THRESHOLD_MS = 120L
    }
}
