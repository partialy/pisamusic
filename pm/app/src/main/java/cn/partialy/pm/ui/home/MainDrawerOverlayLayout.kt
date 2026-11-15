package cn.partialy.pm.ui.home

import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.ViewConfiguration
import android.widget.FrameLayout
import kotlin.math.abs

/**
 * 首页左侧抽屉根容器：支持在抽屉面板与遮罩区域向左横向滑动收起。
 */
class MainDrawerOverlayLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr) {

    interface DragListener {
        fun canDragDrawer(): Boolean
        fun onDrawerDragStart()
        fun onDrawerDragProgress(deltaX: Float)
        fun onDrawerDragEnd(deltaX: Float, velocityX: Float)
    }

    var dragListener: DragListener? = null

    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private var velocityTracker: VelocityTracker? = null
    private var downX = 0f
    private var downY = 0f
    private var dragStartX = 0f
    private var isDragging = false

    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        val listener = dragListener ?: return super.onInterceptTouchEvent(ev)
        if (!listener.canDragDrawer()) {
            resetDragState()
            return false
        }

        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                resetDragState()
                downX = ev.x
                downY = ev.y
                ensureVelocityTracker().addMovement(ev)
            }

            MotionEvent.ACTION_MOVE -> {
                ensureVelocityTracker().addMovement(ev)
                if (isDragging) return true
                val dx = ev.x - downX
                val dy = ev.y - downY
                if (abs(dx) > touchSlop && abs(dx) > abs(dy) && dx < 0f) {
                    beginDrag(ev)
                    return true
                }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                resetDragState()
            }
        }
        return isDragging
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val listener = dragListener ?: return super.onTouchEvent(event)
        if (!listener.canDragDrawer() && !isDragging) {
            return super.onTouchEvent(event)
        }

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = event.x
                downY = event.y
                ensureVelocityTracker().addMovement(event)
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                ensureVelocityTracker().addMovement(event)
                if (!isDragging) {
                    val dx = event.x - downX
                    val dy = event.y - downY
                    if (abs(dx) > touchSlop && abs(dx) > abs(dy) && dx < 0f) {
                        beginDrag(event)
                    }
                }
                if (isDragging) {
                    listener.onDrawerDragProgress(event.x - dragStartX)
                    return true
                }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (isDragging) {
                    val tracker = velocityTracker
                    tracker?.addMovement(event)
                    tracker?.computeCurrentVelocity(1000)
                    val vx = tracker?.xVelocity ?: 0f
                    val deltaX = event.x - dragStartX
                    resetDragState()
                    listener.onDrawerDragEnd(deltaX, vx)
                    return true
                }
                resetDragState()
            }
        }
        return super.onTouchEvent(event)
    }

    override fun onDetachedFromWindow() {
        resetDragState()
        super.onDetachedFromWindow()
    }

    private fun beginDrag(event: MotionEvent) {
        isDragging = true
        dragStartX = event.x
        parent?.requestDisallowInterceptTouchEvent(true)
        dragListener?.onDrawerDragStart()
    }

    private fun ensureVelocityTracker(): VelocityTracker {
        return velocityTracker ?: VelocityTracker.obtain().also { velocityTracker = it }
    }

    private fun resetDragState() {
        isDragging = false
        velocityTracker?.recycle()
        velocityTracker = null
    }
}
