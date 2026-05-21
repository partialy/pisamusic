package cn.partialy.pm.ui.player

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.SystemClock
import android.text.TextPaint
import android.util.AttributeSet
import android.view.Choreographer
import android.view.View
import cn.partialy.pm.lyric.LyricLine
import kotlin.math.abs
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

    // ── 平滑播放进度 ──────────────────────────────────────────────
    private var anchorPositionMs: Long = 0L
    private var anchorUptimeMs: Long = 0L
    private var isPlaying: Boolean = false
    private var positionMs: Long = 0L

    // ── 换行滚动动画 ──────────────────────────────────────────────
    /** 上一次的行索引，用于计算滚动方向和距离 */
    private var prevCurrentIndex: Int = -1
    /** 动画开始时刻（系统 uptimeMs） */
    private var lineAnimStartUptimeMs: Long = 0L
    /** 动画总时长（ms），跳行超过 2 行时自动缩短，避免动画太慢 */
    private var lineAnimDurationMs: Long = 380L
    /** 动画进度 0f～1f */
    private var lineAnimProgress: Float = 1f

    // ── 当前行放大动画（独立于滚动，仅对 currentLine 缩放） ───────
    private var scaleAnimProgress: Float = 1f
    private var scaleAnimStartUptimeMs: Long = 0L
    private val SCALE_ANIM_DURATION_MS = 300L

    // ── Choreographer ─────────────────────────────────────────────
    private val choreographer: Choreographer = Choreographer.getInstance()
    private lateinit var frameCallback: Choreographer.FrameCallback

    init {
        frameCallback = Choreographer.FrameCallback { frameTimeNanos ->
            val frameUptimeMs = frameTimeNanos / 1_000_000L
            var needNextFrame = false

            // 外推播放进度
            if (isPlaying && lines.isNotEmpty() && currentIndex in lines.indices) {
                positionMs = anchorPositionMs + (frameUptimeMs - anchorUptimeMs)
                needNextFrame = true
            }

            // 推进整体滚动动画
            if (lineAnimProgress < 1f) {
                val elapsed = frameUptimeMs - lineAnimStartUptimeMs
                lineAnimProgress = (elapsed.toFloat() / lineAnimDurationMs).coerceIn(0f, 1f)
                needNextFrame = true
            }

            // 推进当前行放大动画
            if (scaleAnimProgress < 1f) {
                val elapsed = frameUptimeMs - scaleAnimStartUptimeMs
                scaleAnimProgress = (elapsed.toFloat() / SCALE_ANIM_DURATION_MS).coerceIn(0f, 1f)
                needNextFrame = true
            }

            if (needNextFrame) {
                invalidate()
                choreographer.postFrameCallback(frameCallback)
            }
        }
    }

    // ── 公开接口 ──────────────────────────────────────────────────

    /**
     * 由外部（播放器）驱动刷新，100ms 调用一次即可，内部自动平滑。
     *
     * @param lines        歌词行列表
     * @param currentIndex 当前高亮行索引
     * @param positionMs   播放器当前位置（毫秒）
     * @param isPlaying    是否播放中（暂停传 false 防止进度漂移）
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
        this.style = style

        // 检测到行切换，启动动画
        if (currentIndex != this.currentIndex) {
            val delta = abs(currentIndex - this.currentIndex)
            if (this.currentIndex >= 0) {
                // 跳行距离越大动画越短，避免慢动作穿越多行
                lineAnimDurationMs = when {
                    delta == 1 -> 380L
                    delta <= 3 -> 280L
                    else       -> 180L
                }
                prevCurrentIndex = this.currentIndex
                lineAnimProgress = 0f
                lineAnimStartUptimeMs = SystemClock.uptimeMillis()

                // 当前行放大动画同步启动
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

        if (oldSize != style.textSizeSp) requestLayout()

        if ((isPlaying && !wasPlaying) || lineAnimProgress < 1f || scaleAnimProgress < 1f) {
            choreographer.postFrameCallback(frameCallback)
        }
        invalidate()
    }

    // ── 生命周期 ──────────────────────────────────────────────────

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (visibility == VISIBLE && isPlaying) {
            anchorUptimeMs = SystemClock.uptimeMillis()
            choreographer.postFrameCallback(frameCallback)
        } else {
            choreographer.removeFrameCallback(frameCallback)
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        choreographer.removeFrameCallback(frameCallback)
    }

    // ── 绘制主循环 ────────────────────────────────────────────────

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (lines.isEmpty() || currentIndex !in lines.indices) return
        val maxTextWidth = (width - paddingLeft - paddingRight).coerceAtLeast(0)
        if (maxTextWidth <= 0) return

        val currentTextSize = currentTextSizePx()
        val normalTextSize  = normalTextSizePx()
        val rowGap    = dp(14f)
        val rowStride = max(textHeight(currentTextSize), textHeight(normalTextSize)) + rowGap
        val centerBaseline = height / 2f - textCenterOffset(currentTextSize)

        // ── 整体滚动偏移 ──────────────────────────────────────────
        // 动画开始时 scrollOffset = (currentIndex - prevCurrentIndex)（正值=向上滚）
        // 随 animT 从 1→0 线性减小，所有行整体平滑上移到目标位置
        val scrollT = easeOutQuart(lineAnimProgress)
        val scrollOffset = if (lineAnimProgress < 1f && prevCurrentIndex >= 0) {
            (currentIndex - prevCurrentIndex) * (1f - scrollT)
        } else {
            0f
        }

        val visibleRadius = max(1, (height / rowStride).roundToInt() / 2 + 2)
        val first = (currentIndex - visibleRadius).coerceAtLeast(0)
        val last  = (currentIndex + visibleRadius).coerceAtMost(lines.lastIndex)

        for (index in first..last) {
            val isCurrent = index == currentIndex
            paint.textSize      = if (isCurrent) currentTextSize else normalTextSize
            paint.isFakeBoldText = isCurrent && style.currentLineBold

            // 所有行的 Y 坐标统一加上滚动偏移，实现整体平滑上移
            val baseline = centerBaseline + (index - currentIndex + scrollOffset) * rowStride

            // 跳过完全超出可见区的行
            if (baseline < -rowStride || baseline > height + rowStride) continue

            if (isCurrent && scaleAnimProgress < 1f) {
                // 当前行在滚动到位的同时，叠加微微放大效果
                val scale = 0.93f + 0.07f * easeOutQuad(scaleAnimProgress)
                canvas.save()
                canvas.translate(width / 2f, baseline)
                canvas.scale(scale, scale)
                canvas.translate(-width / 2f, -baseline)
                drawCurrentLine(canvas, lines[index], baseline, maxTextWidth)
                canvas.restore()
            } else if (isCurrent) {
                drawCurrentLine(canvas, lines[index], baseline, maxTextWidth)
            } else {
                drawNormalLine(canvas, lines[index], baseline, maxTextWidth)
            }
        }
    }

    // ── 行绘制 ────────────────────────────────────────────────────

    /**
     * 绘制当前高亮行；文字超长时改为跟随演唱进度横向滚动，不省略。
     */
    private fun drawCurrentLine(
        canvas: Canvas,
        line: LyricLine,
        baseline: Float,
        maxTextWidth: Int,
    ) {
        val fullText  = line.lineText
        paint.textSize = currentTextSizePx()
        val textWidth = paint.measureText(fullText)

        if (textWidth > maxTextWidth) {
            drawScrollingLine(canvas, line, fullText, textWidth, baseline, maxTextWidth)
        } else {
            paint.color = currentBaseColor()
            val x = lineX(fullText, maxTextWidth)
            canvas.drawText(fullText, x, baseline, paint)
            if (line.hasWordTiming) drawSungPart(canvas, line, fullText, x, baseline)
        }
    }

    /** 绘制普通行（非当前行），超出宽度则省略。 */
    private fun drawNormalLine(
        canvas: Canvas,
        line: LyricLine,
        baseline: Float,
        maxTextWidth: Int,
    ) {
        paint.textSize = normalTextSizePx()
        paint.color    = style.resolvedNormalColor()
        val displayText = ellipsize(line.lineText, maxTextWidth)
        if (displayText.isBlank()) return
        canvas.drawText(displayText, lineX(displayText, maxTextWidth), baseline, paint)
    }

    /**
     * 绘制超长当前行：横向滚动跟随演唱进度。
     *
     * 滚动策略：已唱末尾保持在可视区 40% 处，首尾夹紧不留空白。
     */
    private fun drawScrollingLine(
        canvas: Canvas,
        line: LyricLine,
        fullText: String,
        textWidth: Float,
        baseline: Float,
        maxTextWidth: Int,
    ) {
        val sungWidth = calculateSungWidth(line, fullText)
        val maxScroll = textWidth - maxTextWidth
        // 已唱末尾锁定在可视区 40% 处
        val scrollX = (sungWidth - maxTextWidth * 0.4f).coerceIn(0f, maxScroll)

        val clipLeft  = paddingLeft.toFloat()
        val clipRight = (width - paddingRight).toFloat()
        val drawX     = clipLeft - scrollX   // 负向平移实现文字向左滚动

        canvas.save()
        canvas.clipRect(clipLeft, 0f, clipRight, height.toFloat())

        // ① 底色文字（全部）
        paint.color = currentBaseColor()
        canvas.drawText(fullText, drawX, baseline, paint)

        // ② 已唱高亮（叠加裁剪层）
        if (line.hasWordTiming && sungWidth > 0f) {
            canvas.save()
            canvas.clipRect(clipLeft, 0f, (drawX + sungWidth).coerceAtMost(clipRight), height.toFloat())
            paint.color = style.currentColorArgb
            canvas.drawText(fullText, drawX, baseline, paint)
            canvas.restore()
        }

        canvas.restore()
    }

    /** 对普通长度当前行绘制已唱高亮（裁剪叠加法）。 */
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

    // ── 进度计算 ──────────────────────────────────────────────────

    private fun calculateSungWidth(line: LyricLine, displayText: String): Float {
        var visibleChars = 0
        var width = 0f
        for (word in line.words) {
            if (visibleChars >= displayText.length) break
            val text = word.word.take(displayText.length - visibleChars)
            if (text.isEmpty()) continue
            val wordWidth = paint.measureText(text)
            width += when {
                positionMs >= word.endTime   -> wordWidth
                positionMs <= word.startTime -> 0f
                else -> {
                    val duration = (word.endTime - word.startTime).coerceAtLeast(1L)
                    val elapsed  = (positionMs - word.startTime).coerceIn(0L, duration)
                    wordWidth * elapsed.toFloat() / duration.toFloat()
                }
            }
            visibleChars += text.length
        }
        return width
    }

    // ── 缓动函数 ──────────────────────────────────────────────────

    /** easeOutQuad：滚动用，先快后慢，顿感强 */
    private fun easeOutQuad(t: Float) = 1f - (1f - t) * (1f - t)

    /** easeOutQuart：整体滚动用，起步更快，落点更稳 */
    private fun easeOutQuart(t: Float): Float {
        val v = 1f - t
        return 1f - v * v * v * v
    }

    // ── 辅助 ──────────────────────────────────────────────────────

    private fun ellipsize(text: String, maxTextWidth: Int): String =
        android.text.TextUtils.ellipsize(
            text, paint, maxTextWidth.toFloat(), android.text.TextUtils.TruncateAt.END,
        ).toString()

    private fun lineX(text: String, maxTextWidth: Int): Float {
        val textWidth = paint.measureText(text)
        return when (style.alignment) {
            LyricAlignment.START  -> paddingLeft.toFloat()
            LyricAlignment.CENTER -> paddingLeft + (maxTextWidth - textWidth) / 2f
            LyricAlignment.END    -> width - paddingRight - textWidth
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

    private fun currentBaseColor() =
        Color.argb(255, Color.red(style.normalColorArgb), Color.green(style.normalColorArgb), Color.blue(style.normalColorArgb))

    private fun dp(value: Float) = value * resources.displayMetrics.density
    private fun sp(value: Float) = value * resources.displayMetrics.scaledDensity
}