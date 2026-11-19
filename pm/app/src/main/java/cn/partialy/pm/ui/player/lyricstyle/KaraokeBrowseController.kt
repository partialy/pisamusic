package cn.partialy.pm.ui.player.lyricstyle

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.ViewConfiguration
import android.widget.OverScroller
import cn.partialy.pm.ui.player.PlayerSwipeDirectionPolicy
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * 拆分自 KaraokeLyricsView 的手动浏览与回弹控制器：
 * 负责手势方向仲裁、垂直拖动、惯性滚动及 3 秒超时平滑回弹。
 */
internal class KaraokeBrowseController(
    context: Context,
    private val requestDisallowIntercept: (Boolean) -> Unit,
    private val requestFrame: () -> Unit,
    private val requestInvalidate: () -> Unit,
    private val performClickAction: () -> Unit,
    private val getLineCount: () -> Int,
    private val getCurrentIndex: () -> Int,
    private val getRowStride: () -> Float,
    private val onBrowseLineChanged: (Int) -> Unit,
    private val onBrowseEnded: () -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scroller = OverScroller(context)
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private val minimumFlingVelocity = ViewConfiguration.get(context).scaledMinimumFlingVelocity
    private val maximumFlingVelocity = ViewConfiguration.get(context).scaledMaximumFlingVelocity

    private var velocityTracker: VelocityTracker? = null
    private var lastTouchY = 0f
    private var touchDownY = 0f
    private var touchDownX = 0f
    private var gestureDirection = PlayerSwipeDirectionPolicy.Direction.UNDECIDED
    private var isDragging = false

    var browseCenterPosition = 0f
        private set
    private var browseLineIndex = -1
    var isBrowsing = false
        private set
    var isAutoReturning = false
        private set
    private var returnStartPosition = 0f
    var returnCenterPosition = 0f
        private set
    private var returnStartUptimeMs = 0L

    private val browseTimeoutRunnable = Runnable {
        startAutoReturnToPlayback(notify = true)
    }

    val browsedLineIndex: Int
        get() = if (isBrowsing && !isAutoReturning) browseLineIndex else -1

    val hasActiveAnimation: Boolean
        get() = !scroller.isFinished || isAutoReturning

    fun onTouchEvent(event: MotionEvent): Boolean {
        val count = getLineCount()
        if (count <= 0) return false
        val lastIndex = count - 1
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                requestDisallowIntercept(false)
                gestureDirection = PlayerSwipeDirectionPolicy.Direction.UNDECIDED
                touchDownX = event.x
                recycleVelocityTracker()
                scroller.forceFinished(true)
                velocityTracker = VelocityTracker.obtain().also { it.addMovement(event) }
                lastTouchY = event.y
                touchDownY = event.y
                isDragging = false
                isAutoReturning = false
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                velocityTracker?.addMovement(event)
                val dy = event.y - lastTouchY
                gestureDirection = PlayerSwipeDirectionPolicy.resolve(
                    event.x - touchDownX,
                    event.y - touchDownY,
                    touchSlop.toFloat(),
                    gestureDirection,
                )
                if (gestureDirection == PlayerSwipeDirectionPolicy.Direction.HORIZONTAL) {
                    requestDisallowIntercept(false)
                    recycleVelocityTracker()
                    return true
                }
                if (!isDragging && gestureDirection == PlayerSwipeDirectionPolicy.Direction.VERTICAL) {
                    requestDisallowIntercept(true)
                    isDragging = true
                    beginBrowsing()
                }
                if (isDragging) {
                    val stride = getRowStride().coerceAtLeast(1f)
                    browseCenterPosition = (browseCenterPosition - dy / stride)
                        .coerceIn(0f, lastIndex.toFloat())
                    notifyBrowseLineChanged()
                    resetBrowseTimeout()
                    requestInvalidate()
                }
                lastTouchY = event.y
                return true
            }
            MotionEvent.ACTION_UP -> {
                velocityTracker?.addMovement(event)
                velocityTracker?.computeCurrentVelocity(1000, maximumFlingVelocity.toFloat())
                val velocityY = velocityTracker?.yVelocity ?: 0f
                recycleVelocityTracker()
                requestDisallowIntercept(false)
                val direction = gestureDirection
                gestureDirection = PlayerSwipeDirectionPolicy.Direction.UNDECIDED
                if (direction == PlayerSwipeDirectionPolicy.Direction.HORIZONTAL) return true
                if (!isDragging) {
                    beginBrowsing()
                    performClickAction()
                }
                isDragging = false
                if (direction == PlayerSwipeDirectionPolicy.Direction.VERTICAL && abs(velocityY) >= minimumFlingVelocity) {
                    startBrowseFling(velocityY)
                } else {
                    snapBrowseCenter()
                }
                resetBrowseTimeout()
                return true
            }
            MotionEvent.ACTION_POINTER_DOWN, MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_CANCEL -> {
                gestureDirection = PlayerSwipeDirectionPolicy.Direction.HORIZONTAL
                recycleVelocityTracker()
                requestDisallowIntercept(false)
                isDragging = false
                if (isBrowsing) resetBrowseTimeout()
                return true
            }
        }
        return false
    }

    fun stepAnimation(frameUptimeMs: Long): Boolean {
        val count = getLineCount()
        if (count <= 0) return false
        val lastIndex = count - 1
        var needNextFrame = false

        if (!scroller.isFinished) {
            if (scroller.computeScrollOffset()) {
                browseCenterPosition = (scroller.currY / SCROLLER_ROW_UNIT).coerceIn(0f, lastIndex.toFloat())
                notifyBrowseLineChanged()
                needNextFrame = true
            } else {
                scroller.forceFinished(true)
                snapBrowseCenter()
            }
        }

        if (isAutoReturning) {
            val elapsed = frameUptimeMs - returnStartUptimeMs
            val progress = (elapsed.toFloat() / RETURN_ANIM_DURATION_MS).coerceIn(0f, 1f)
            val target = getCurrentIndex().coerceIn(0, lastIndex).toFloat()
            returnCenterPosition = returnStartPosition + (target - returnStartPosition) * easeOutCubic(progress)
            if (progress >= 1f) {
                isAutoReturning = false
                isBrowsing = false
                browseCenterPosition = target
                requestInvalidate()
            } else {
                needNextFrame = true
            }
        }

        return needNextFrame
    }

    fun onLinesUpdated() {
        val count = getLineCount()
        if (count <= 0) return
        if (isBrowsing && !isAutoReturning) {
            browseCenterPosition = browseCenterPosition.coerceIn(0f, (count - 1).toFloat())
            notifyBrowseLineChanged()
        }
    }

    fun finishBrowsing(notify: Boolean) {
        if (!isBrowsing) return
        isBrowsing = false
        isAutoReturning = false
        isDragging = false
        scroller.forceFinished(true)
        mainHandler.removeCallbacks(browseTimeoutRunnable)
        if (notify) onBrowseEnded()
        requestInvalidate()
    }

    fun stopAll() {
        isAutoReturning = false
        isBrowsing = false
        isDragging = false
        scroller.forceFinished(true)
        mainHandler.removeCallbacks(browseTimeoutRunnable)
        recycleVelocityTracker()
    }

    fun onDetached() {
        mainHandler.removeCallbacks(browseTimeoutRunnable)
        recycleVelocityTracker()
    }

    private fun beginBrowsing() {
        val count = getLineCount()
        if (count <= 0) return
        if (!isBrowsing) {
            browseCenterPosition = getCurrentIndex().coerceIn(0, count - 1).toFloat()
            isBrowsing = true
        }
        notifyBrowseLineChanged()
        resetBrowseTimeout()
    }

    private fun startAutoReturnToPlayback(notify: Boolean) {
        if (!isBrowsing) return
        val count = getLineCount()
        val currentIdx = getCurrentIndex()
        if (currentIdx !in 0 until count) {
            finishBrowsing(notify)
            return
        }
        isDragging = false
        scroller.forceFinished(true)
        mainHandler.removeCallbacks(browseTimeoutRunnable)
        returnStartPosition = browseCenterPosition.coerceIn(0f, (count - 1).toFloat())
        returnCenterPosition = returnStartPosition
        returnStartUptimeMs = SystemClock.uptimeMillis()
        isAutoReturning = true
        if (notify) onBrowseEnded()
        requestFrame()
        requestInvalidate()
    }

    private fun resetBrowseTimeout() {
        mainHandler.removeCallbacks(browseTimeoutRunnable)
        mainHandler.postDelayed(browseTimeoutRunnable, BROWSE_TIMEOUT_MS)
    }

    private fun notifyBrowseLineChanged() {
        val count = getLineCount()
        if (!isBrowsing || count <= 0) return
        val idx = browseCenterPosition.roundToInt().coerceIn(0, count - 1)
        if (idx != browseLineIndex) {
            browseLineIndex = idx
        }
        onBrowseLineChanged(idx)
    }

    private fun snapBrowseCenter() {
        val count = getLineCount()
        if (!isBrowsing || count <= 0) return
        browseCenterPosition = browseCenterPosition.roundToInt().coerceIn(0, count - 1).toFloat()
        notifyBrowseLineChanged()
        requestInvalidate()
    }

    private fun startBrowseFling(velocityY: Float) {
        val count = getLineCount()
        if (!isBrowsing || count <= 0) return
        val startY = (browseCenterPosition * SCROLLER_ROW_UNIT).roundToInt()
        val stride = getRowStride().coerceAtLeast(1f)
        val flingVelocity = (-velocityY / stride * SCROLLER_ROW_UNIT).roundToInt()
        scroller.fling(
            0,
            startY,
            0,
            flingVelocity,
            0,
            0,
            0,
            ((count - 1) * SCROLLER_ROW_UNIT).roundToInt(),
        )
        requestFrame()
    }

    private fun recycleVelocityTracker() {
        velocityTracker?.recycle()
        velocityTracker = null
    }

    private companion object {
        const val BROWSE_TIMEOUT_MS = 3_000L
        const val RETURN_ANIM_DURATION_MS = 520L
        const val SCROLLER_ROW_UNIT = 1000f
    }
}
