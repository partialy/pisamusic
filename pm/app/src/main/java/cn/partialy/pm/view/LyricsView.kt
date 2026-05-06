 package cn.partialy.pm.view

 import android.animation.ValueAnimator
 import android.content.Context
 import android.graphics.Canvas
 import android.graphics.Color
 import android.graphics.Paint
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
 import android.util.AttributeSet
 import android.view.View
 import android.view.animation.DecelerateInterpolator
 import androidx.core.graphics.toColorInt

 class LyricsView @JvmOverloads constructor(
     context: Context,
     attrs: AttributeSet? = null,
     defStyleAttr: Int = 0,
 ) : View(context, attrs, defStyleAttr) {

    @Deprecated("已被 RecyclerView 歌词列表替代；保留仅为兼容旧引用。")
   private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG)
    private var lyrics: List<LyricLine> = emptyList()
    private var currentLineIndex = 0
    private var lineHeight = 0f
    private var textSize = 50f
    private var highlightColor = "#FFFFFFFF".toColorInt()
    private var normalColor = "#4DBFBFBF".toColorInt()
    private val highlightSizeScale = 1.25f
    private var offsetY = 0f
    private var startOffsetY = 0f
    private var targetOffsetY = 0f

    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 200
        interpolator = DecelerateInterpolator()
        addUpdateListener { animation ->
            val fraction = animation.animatedValue as Float
            offsetY = startOffsetY + (targetOffsetY - startOffsetY) * fraction
            invalidate()
        }
    }

    init {
        paint.textSize = textSize
        paint.textAlign = Paint.Align.CENTER
        lineHeight = paint.fontSpacing * 2.1f
    }

    fun adjustTextSize(delta: Float) {
        textSize = (textSize + delta).coerceIn(30f, 80f)
        paint.textSize = textSize
        lineHeight = paint.fontSpacing * 2.1f
        invalidate()
    }

    fun setLyrics(lyricsText: String) {
        lyrics = parseLyrics(lyricsText)
        currentLineIndex = 0
        offsetY = 0f
        startOffsetY = 0f
        targetOffsetY = 0f
        invalidate()
    }

    fun updateTime(currentTime: Long) {
        for (i in lyrics.indices) {
            if (i == lyrics.size - 1 || currentTime < lyrics[i + 1].timeStamp) {
                if (currentLineIndex != i) {
                    currentLineIndex = i
                    startOffsetY = offsetY
                    targetOffsetY = -i * lineHeight
                    animator.cancel()
                    animator.start()
                }
                break
            }
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (lyrics.isEmpty()) return

        val centerY = height / 2f
        val centerX = width / 2f
        val maxWidthPx = (width - 40f).coerceAtLeast(0f)
        val maxWidth = maxWidthPx.toInt().coerceAtLeast(1)

        val startIndex = (currentLineIndex - 5).coerceAtLeast(0)
        val endIndex = (currentLineIndex + 5).coerceAtMost(lyrics.size - 1)

        for (i in startIndex..endIndex) {
            val y = centerY + offsetY + (i * lineHeight)
            val isHighlighted = i == currentLineIndex
            paint.color = if (isHighlighted) highlightColor else normalColor
            paint.isFakeBoldText = isHighlighted
            paint.textSize = if (isHighlighted) textSize * highlightSizeScale else textSize

            val text = lyrics[i].text
            val layout = StaticLayout.Builder
                .obtain(text, 0, text.length, paint, maxWidth)
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setIncludePad(false)
                .setLineSpacing(0f, 1.0f)
                .setMaxLines(3)
                .setEllipsize(TextUtils.TruncateAt.END)
                .build()

            val textTop = y - (layout.height / 2f)
            canvas.save()
            canvas.translate(centerX - (layout.width / 2f), textTop)
            layout.draw(canvas)
            canvas.restore()
        }
    }

    private fun parseLyrics(lyricsText: String): List<LyricLine> {
        val lines = lyricsText.split("\n")
        val lyricLines = mutableListOf<LyricLine>()
        val timePattern = "\\[(\\d{2}):(\\d{2})\\.(\\d{2,3})]".toRegex()

        for (line in lines) {
            val matcher = timePattern.find(line) ?: continue
            val timeGroups = matcher.groupValues
            val minutes = timeGroups[1].toInt()
            val seconds = timeGroups[2].toInt()
            val milliseconds = timeGroups[3].toInt()
            val timestamp = (minutes * 60 * 1000 + seconds * 1000 + milliseconds).toLong()
            val text = line.substring(matcher.range.last + 1).trim()
            if (text.isNotEmpty()) {
                lyricLines.add(LyricLine(timestamp, text))
            }
        }

        return lyricLines.sortedBy { it.timeStamp }
    }

    data class LyricLine(val timeStamp: Long, val text: String)

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        animator.cancel()
    }
 }