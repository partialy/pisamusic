package cn.partialy.pm.ui.home

import android.view.MotionEvent
import android.view.ViewGroup
import android.view.ViewParent
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.widget.ViewPager2

/**
 * 只禁止外层 [ViewPager2] 及其内层翻页 [RecyclerView] 拦截触摸，不误切「推荐 / 我喜欢」；
 * **不**对 [androidx.core.widget.NestedScrollView] 等整链 disallow，竖滑整页仍正常。
 */
internal fun RecyclerView.disallowViewPager2PagingAncestorsOnly() {
    var p: ViewParent? = parent
    while (p != null) {
        val gp = p.parent
        if (gp is ViewPager2 && p is ViewGroup) {
            p.requestDisallowInterceptTouchEvent(true)
        }
        if (p is ViewPager2) {
            p.requestDisallowInterceptTouchEvent(true)
            break
        }
        p = gp
    }
}

/**
 * 首页横向条（如功能卡片）：在 [ACTION_DOWN]、[ACTION_MOVE]、[ACTION_POINTER_DOWN] 重复设置，
 * 避免快速横滑时 ViewPager2 内层 RecyclerView 再次 intercept。
 */
fun RecyclerView.requestDisallowViewPager2InterceptOnHorizontalDrag() {
    addOnItemTouchListener(
        object : RecyclerView.SimpleOnItemTouchListener() {
            override fun onInterceptTouchEvent(rv: RecyclerView, e: MotionEvent): Boolean {
                when (e.actionMasked) {
                    MotionEvent.ACTION_DOWN,
                    MotionEvent.ACTION_MOVE,
                    MotionEvent.ACTION_POINTER_DOWN -> rv.disallowViewPager2PagingAncestorsOnly()
                }
                return false
            }
        },
    )
}
