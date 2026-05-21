package cn.partialy.pm.ui.player

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.SystemClock
import android.text.TextPaint
import android.text.TextUtils
import android.util.AttributeSet
import android.view.Choreographer
import android.view.View
import cn.partialy.pm.lyric.LyricLine
import kotlin.math.max
import kotlin.math.roundToInt

class KaraokeLyricsView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

    private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.LEFT
    }

    private var lines: List<LyricLine> = emptyList()
    private var currentIndex: Int = -1
    private var style: LyricDisplayStyle = LyricDisplayStyle.DEFAULT

    // ── 平滑播放进度相关 ────────────────────────────────────────
    /** 外部最后一次传入的播放位置（毫秒） */
    private var anchorPositionMs: Long = 0L

    /** anchorPositionMs 对应的系统 uptimeMillis，用于在帧间外推当前进度 */
    private var anchorUptimeMs: Long = 0L

    /** 是否处于播放状态（暂停时停止外推，防止进度漂移） */
    private var isPlaying: Boolean = false

    /** 由 Choreographer 每帧计算得到的"当前"播放位置，onDraw 使用此值 */
    private var positionMs: Long = 0L

    // ── Choreographer 帧回调 ────────────────────────────────────
    private val choreographer: Choreographer = Choreographer.getInstance()

    /**
     * 每帧回调：根据系统时钟外推当前播放进度，然后触发重绘。
     * 只要 View 可见且处于播放状态就会持续注册，形成与屏幕刷新率同步的驱动循环。
     */
    private lateinit var frameCallback: Choreographer.FrameCallback

    init {
        frameCallback = Choreographer.FrameCallback { frameTimeNanos ->
            if (isPlaying && lines.isNotEmpty() && currentIndex in lines.indices) {
                // frameTimeNanos 是本帧的 VSYNC 时间戳（纳秒），转换为毫秒
                val frameUptimeMs = frameTimeNanos / 1_000_000L
                // 外推：当前进度 = 上次已知进度 + 自上次更新经过的时间
                positionMs = anchorPositionMs + (frameUptimeMs - anchorUptimeMs)
                invalidate()
                // 注册下一帧，驱动下一次重绘
                choreographer.postFrameCallback(frameCallback)
            }
        }
    }

    // ── 公开接口 ────────────────────────────────────────────────

    /**
     * 由外部（播放器）驱动刷新。
     * 调用频率无需很高（100ms 一次完全够用），View 内部会自动在每帧平滑外推进度。
     *
     * @param lines        解析好的歌词行列表
     * @param currentIndex 当前高亮行索引
     * @param positionMs   当前播放位置（毫秒），建议传入精确的播放器时间
     * @param isPlaying    是否正在播放；暂停时传 false 防止进度漂移
     * @param style        显示样式
     */
    fun bind(
        lines: List<LyricLine>,
        currentIndex: Int,
        positionMs: Long,
        isPlaying: Boolean = true,
        style: LyricDisplayStyle,
    ) {
        val oldSize = this.style.textSizeSp
        this.lines = lines
        this.currentIndex = currentIndex
        this.style = style
        val wasPlaying = this.isPlaying
        this.isPlaying = isPlaying

        // 记录播放锚点：此刻的进度 + 此刻的系统时钟
        // 下一帧起就可以用 "anchorPosition + elapsed" 精确外推
        anchorPositionMs = positionMs
        anchorUptimeMs = SystemClock.uptimeMillis()
        this.positionMs = positionMs // 立即更新，避免首帧用旧值

        if (oldSize != style.textSizeSp) requestLayout()

        // 从暂停恢复播放，或首次开始播放时，启动帧驱动循环
        if (isPlaying && !wasPlaying) {
            choreographer.postFrameCallback(frameCallback)
        }

        invalidate()
    }

    // ── 生命周期：随 View 可见性启停帧循环 ──────────────────────

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (visibility == VISIBLE && isPlaying) {
            // View 重新可见时重新锚定时间，避免进度跳变
            anchorUptimeMs = SystemClock.uptimeMillis()
            choreographer.postFrameCallback(frameCallback)
        } else {
            choreographer.removeFrameCallback(frameCallback)
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        // 防止 View 销毁后 Choreographer 继续持有引用，造成内存泄漏
        choreographer.removeFrameCallback(frameCallback)
    }

    // ── 绘制 ────────────────────────────────────────────────────

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (lines.isEmpty() || currentIndex !in lines.indices) return
        val maxTextWidth = (width - paddingLeft - paddingRight).coerceAtLeast(0)
        if (maxTextWidth <= 0) return

        val currentTextSize = currentTextSizePx()
        val normalTextSize = normalTextSizePx()
        val rowGap = dp(14f)
        val currentLineHeight = textHeight(currentTextSize)
        val normalLineHeight = textHeight(normalTextSize)
        val rowStride = max(currentLineHeight, normalLineHeight) + rowGap
        val centerBaseline = height / 2f - textCenterOffset(currentTextSize)
        val visibleRadius = max(1, (height / rowStride).roundToInt() / 2 + 1)
        val first = (currentIndex - visibleRadius).coerceAtLeast(0)
        val last = (currentIndex + visibleRadius).coerceAtMost(lines.lastIndex)

        for (index in first..last) {
            val isCurrent = index == currentIndex
            paint.textSize = if (isCurrent) currentTextSize else normalTextSize
            paint.isFakeBoldText = isCurrent && style.currentLineBold
            paint.color = if (isCurrent) currentBaseColor() else style.resolvedNormalColor()

            val baseline = centerBaseline + (index - currentIndex) * rowStride
            val displayText = ellipsize(lines[index].lineText, maxTextWidth)
            if (displayText.isBlank()) continue
            val x = lineX(displayText, maxTextWidth)
            canvas.drawText(displayText, x, baseline, paint)

            if (isCurrent && lines[index].hasWordTiming) {
                drawSungPart(canvas, lines[index], displayText, x, baseline)
            }
        }
    }

    private fun drawSungPart(
        canvas: Canvas,
        line: LyricLine,
        displayText: String,
        x: Float,
        baseline: Float,
    ) {
        val sungWidth = calculateSungWidth(line, displayText)
        if (sungWidth <= 0f) return
        canvas.save()
        canvas.clipRect(x, 0f, x + sungWidth.coerceAtMost(paint.measureText(displayText)), height.toFloat())
        paint.color = style.currentColorArgb
        canvas.drawText(displayText, x, baseline, paint)
        canvas.restore()
    }

    /**
     * 计算当前时刻已唱部分的像素宽度。
     * positionMs 由 Choreographer 每帧外推更新，因此此处无需额外插值逻辑。
     */
    private fun calculateSungWidth(line: LyricLine, displayText: String): Float {
        var visibleChars = 0
        var width = 0f
        for (word in line.words) {
            if (visibleChars >= displayText.length) break
            val text = word.word.take(displayText.length - visibleChars)
            if (text.isEmpty()) continue
            val wordWidth = paint.measureText(text)
            width += when {
                positionMs >= word.endTime -> wordWidth
                positionMs <= word.startTime -> 0f
                else -> {
                    val duration = (word.endTime - word.startTime).coerceAtLeast(1L)
                    val elapsed = (positionMs - word.startTime).coerceIn(0L, duration)
                    wordWidth * (elapsed.toFloat() / duration.toFloat())
                }
            }
            visibleChars += text.length
        }
        return width
    }

    // ── 辅助方法（与原版保持一致） ──────────────────────────────

    private fun ellipsize(text: String, maxTextWidth: Int): String =
        TextUtils.ellipsize(
            text,
            paint,
            maxTextWidth.toFloat(),
            TextUtils.TruncateAt.END,
        ).toString()

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

    private fun currentTextSizePx(): Float =
        sp(
            if (style.currentLineEnlarged) {
                style.textSizeSp + style.currentLineEnlargedDxSp
            } else {
                style.textSizeSp
            },
        )

    private fun normalTextSizePx(): Float = sp(style.textSizeSp)

    private fun currentBaseColor(): Int =
        Color.argb(
            255,
            Color.red(style.normalColorArgb),
            Color.green(style.normalColorArgb),
            Color.blue(style.normalColorArgb),
        )

    private fun dp(value: Float): Float = value * resources.displayMetrics.density

    private fun sp(value: Float): Float = value * resources.displayMetrics.scaledDensity
}