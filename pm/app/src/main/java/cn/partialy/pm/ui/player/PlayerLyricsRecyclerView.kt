package cn.partialy.pm.ui.player

import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ViewConfiguration
import androidx.recyclerview.widget.RecyclerView

/** 歌词纵向浏览在超过阈值后锁定；横向交给外层 Pager。 */
class PlayerLyricsRecyclerView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : RecyclerView(context, attrs) {
    private var multiTouch = false
    private var downX = 0f
    private var downY = 0f
    private var direction = PlayerSwipeDirectionPolicy.Direction.UNDECIDED
    private val slop = ViewConfiguration.get(context).scaledTouchSlop.toFloat()
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> { multiTouch = false; downX = event.x; downY = event.y; direction = PlayerSwipeDirectionPolicy.Direction.UNDECIDED }
            MotionEvent.ACTION_MOVE -> {
                if (multiTouch) return super.dispatchTouchEvent(event)
                direction = PlayerSwipeDirectionPolicy.resolve(event.x - downX, event.y - downY, slop, direction)
                parent?.requestDisallowInterceptTouchEvent(direction == PlayerSwipeDirectionPolicy.Direction.VERTICAL)
            }
            MotionEvent.ACTION_POINTER_DOWN, MotionEvent.ACTION_POINTER_UP -> {
                multiTouch = true
                // 多指本次保持歌词所有权，避免剩余指针相对旧起点被误判为翻页。
                parent?.requestDisallowInterceptTouchEvent(true)
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                multiTouch = false
                parent?.requestDisallowInterceptTouchEvent(false)
                direction = PlayerSwipeDirectionPolicy.Direction.UNDECIDED
            }
        }
        return super.dispatchTouchEvent(event)
    }
}
