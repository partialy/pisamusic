package cn.partialy.pm.ui.player

import android.content.Context
import android.util.AttributeSet
import android.view.ViewGroup
import kotlin.math.min

/** 方形封面在前，CD 中心对齐封面右边缘；组合整体居中并避让歌词和控制区。 */
class PlayerCoverStageLayout @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null,
) : ViewGroup(context, attrs) {
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec)
        val h = MeasureSpec.getSize(heightMeasureSpec)
        setMeasuredDimension(w, h)
        val availableHeight = (h - paddingTop - paddingBottom - dp(12)).coerceAtLeast(0)
        val availableWidth = (w - paddingLeft - paddingRight - dp(8)).coerceAtLeast(0)
        val cover = min((availableWidth / 1.45f).toInt(), availableHeight)
        for (i in 0 until childCount) {
            val size = if (i == 0) (cover * .90f).toInt() else cover
            getChildAt(i).measure(MeasureSpec.makeMeasureSpec(size, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(size, MeasureSpec.EXACTLY))
        }
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val cover = getChildAt(1) ?: return
        val size = cover.measuredWidth
        val disc = getChildAt(0)
        val compositionWidth = size + disc.measuredWidth / 2
        val left = paddingLeft + (width - paddingLeft - paddingRight - compositionWidth) / 2
        val top = paddingTop + (height - paddingTop - paddingBottom - size) / 2
        val discLeft = left + size - disc.measuredWidth / 2
        val discTop = top + (size - disc.measuredHeight) / 2
        disc.layout(discLeft, discTop, discLeft + disc.measuredWidth, discTop + disc.measuredHeight)
        cover.layout(left, top, left + size, top + size)
    }

    override fun generateDefaultLayoutParams() = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    override fun generateLayoutParams(attrs: AttributeSet) = LayoutParams(context, attrs)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
