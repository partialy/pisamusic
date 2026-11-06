package cn.partialy.pm.ui.player

import android.content.Context
import android.util.AttributeSet
import android.view.View
import android.view.ViewGroup
import kotlin.math.min

/** 封面尺寸同时受宽度和剩余高度约束，小窗口优先让出歌词和控制区。 */
class PlayerCoverStageLayout @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null,
) : ViewGroup(context, attrs) {
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec)
        val h = MeasureSpec.getSize(heightMeasureSpec)
        setMeasuredDimension(w, h)
        val availableHeight = (h - paddingTop - paddingBottom - dp(12)).coerceAtLeast(0)
        val cover = min(((w - paddingLeft - paddingRight) / 1.25f).toInt(), availableHeight)
        for (i in 0 until childCount) {
            val size = if (i == 0) (cover * .94f).toInt() else cover
            getChildAt(i).measure(MeasureSpec.makeMeasureSpec(size, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(size, MeasureSpec.EXACTLY))
        }
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val cover = getChildAt(1) ?: return
        val size = cover.measuredWidth
        val left = paddingLeft + ((width - paddingLeft - paddingRight - size * 1.25f) / 2f).toInt()
        val top = paddingTop + (height - paddingTop - paddingBottom - size) / 2
        val disc = getChildAt(0)
        val discLeft = left + (size * .31f).toInt()
        val discTop = top + (size - disc.measuredHeight) / 2
        disc.layout(discLeft, discTop, discLeft + disc.measuredWidth, discTop + disc.measuredHeight)
        cover.layout(left, top, left + size, top + size)
    }

    override fun generateDefaultLayoutParams() = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    override fun generateLayoutParams(attrs: AttributeSet) = LayoutParams(context, attrs)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
