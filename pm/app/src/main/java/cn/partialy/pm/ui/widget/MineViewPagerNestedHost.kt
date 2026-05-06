package cn.partialy.pm.ui.widget

import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.widget.FrameLayout
import androidx.viewpager2.widget.ViewPager2
import kotlin.math.abs

/**
 * 将 [ViewPager2] 放在 [androidx.core.widget.NestedScrollView] 内时，
 * 区分横向翻页与纵向滚动，避免抢手势。
 */
class MineViewPagerNestedHost @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : FrameLayout(context, attrs) {

    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private var initialX = 0f
    private var initialY = 0f

    override fun onInterceptTouchEvent(e: MotionEvent): Boolean {
        val vp = getChildAt(0) as? ViewPager2 ?: return super.onInterceptTouchEvent(e)
        if (vp.orientation != ViewPager2.ORIENTATION_HORIZONTAL) {
            return super.onInterceptTouchEvent(e)
        }
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                initialX = e.x
                initialY = e.y
                parent.requestDisallowInterceptTouchEvent(true)
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = e.x - initialX
                val dy = e.y - initialY
                val adx = abs(dx)
                val ady = abs(dy)
                if (adx > touchSlop || ady > touchSlop) {
                    if (adx > ady) {
                        parent.requestDisallowInterceptTouchEvent(true)
                    } else {
                        parent.requestDisallowInterceptTouchEvent(false)
                    }
                }
            }
        }
        return super.onInterceptTouchEvent(e)
    }
}
