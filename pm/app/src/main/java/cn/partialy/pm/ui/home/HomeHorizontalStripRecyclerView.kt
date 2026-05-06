package cn.partialy.pm.ui.home

import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import androidx.recyclerview.widget.RecyclerView

/**
 * 首页歌单 / 今日歌曲等横向条：只禁止外层 [ViewPager2] 及其内层翻页列表拦截触摸（不误切「推荐 / 我喜欢」），
 * **不**对 [androidx.core.widget.NestedScrollView] 等中间父布局调用 disallow，竖滑整页仍正常。
 *
 * 在 [ACTION_DOWN]、[ACTION_MOVE]、[ACTION_POINTER_DOWN] 重复设置，避免快速横滑时再次 intercept。
 */
class HomeHorizontalStripRecyclerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : RecyclerView(context, attrs, defStyleAttr) {

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN,
            MotionEvent.ACTION_MOVE,
            MotionEvent.ACTION_POINTER_DOWN -> disallowViewPager2PagingAncestorsOnly()
        }
        return super.dispatchTouchEvent(ev)
    }
}
