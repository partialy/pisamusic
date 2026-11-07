package cn.partialy.pm.ui.download

import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ViewConfiguration
import androidx.recyclerview.widget.RecyclerView
import kotlin.math.abs

/** 只仲裁列表内触摸；系统边缘返回不被 Activity 级手势监听截获。 */
class DownloadTaskRecyclerView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : RecyclerView(context, attrs) {
    private var startX = 0f
    private var startY = 0f
    private var edge = false
    private val slop = ViewConfiguration.get(context).scaledTouchSlop
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                startX = event.x; startY = event.y
                val edgeWidth = 24 * resources.displayMetrics.density
                edge = event.x < edgeWidth || event.x > width - edgeWidth
                parent.requestDisallowInterceptTouchEvent(true)
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = abs(event.x - startX); val dy = abs(event.y - startY)
                if (dx > slop || dy > slop) parent.requestDisallowInterceptTouchEvent(edge || dy >= dx)
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> parent.requestDisallowInterceptTouchEvent(false)
        }
        return super.dispatchTouchEvent(event)
    }
}
