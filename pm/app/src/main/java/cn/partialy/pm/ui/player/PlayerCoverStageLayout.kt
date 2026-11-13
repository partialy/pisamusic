package cn.partialy.pm.ui.player

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.AnimatorSet
import android.animation.ValueAnimator
import android.content.Context
import android.os.SystemClock
import android.util.AttributeSet
import android.view.ViewGroup
import androidx.interpolator.view.animation.FastOutSlowInInterpolator
import com.google.android.material.imageview.ShapeableImageView
import kotlin.math.min

/** 方形封面在前，CD 中心对齐封面右边缘；组合整体居中并避让歌词和控制区。 */
class PlayerCoverStageLayout @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null,
) : ViewGroup(context, attrs) {
    private var active = false
    private var closeProgress = 0f
    private var transition: AnimatorSet? = null
    private var lastSongChangeAt = 0L
    private var notchRadius = -1f

    fun setActive(active: Boolean) {
        this.active = active
        if (!active) resetTransition()
    }

    fun animateSongChange() {
        // 动画期间的连续切歌只更新歌曲，共用这一轮动画，不排队也不延长停留。
        if (!active || !isAttachedToWindow || !isShown || width == 0 ||
            !ValueAnimator.areAnimatorsEnabled()) return
        val now = SystemClock.uptimeMillis()
        val sameBurst = lastSongChangeAt != 0L && now - lastSongChangeAt < 2_000L
        lastSongChangeAt = now
        // 临近上一轮结束的连点也归为同一批，避免跨过动画边界后立刻再播一轮。
        if (transition != null || sameBurst) return
        val close = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 1_000L
            interpolator = FastOutSlowInInterpolator()
            addUpdateListener { setCloseProgress(it.animatedValue as Float) }
        }
        val open = ValueAnimator.ofFloat(1f, 0f).apply {
            startDelay = 1_000L
            duration = 1_000L
            interpolator = FastOutSlowInInterpolator()
            addUpdateListener { setCloseProgress(it.animatedValue as Float) }
        }
        val animation = AnimatorSet().apply { playSequentially(close, open) }
        transition = animation
        animation.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                if (transition === animation) {
                    transition = null
                    setCloseProgress(0f)
                }
            }
        })
        animation.start()
    }

    fun resetTransition() {
        val animation = transition
        transition = null
        lastSongChangeAt = 0L
        animation?.cancel()
        setCloseProgress(0f)
    }

    private fun setCloseProgress(progress: Float) {
        closeProgress = progress
        applyComposition()
    }

    private fun applyComposition() {
        val cover = getChildAt(1) as? ShapeableImageView ?: return
        val disc = getChildAt(0) ?: return
        val center = paddingLeft + (width - paddingLeft - paddingRight) / 2f
        cover.translationX = (center - cover.left - cover.width / 2f) * closeProgress
        disc.translationX = (center - disc.left - disc.width / 2f) * closeProgress
        // 缺口直径是中心黑点的 4.5/4；合拢时同步闭合，CD 才能被封面完全挡住。
        val discRadius = (minOf(disc.width, disc.height) / 2f - resources.displayMetrics.density).coerceAtLeast(0f)
        val radius = discRadius * CompactDiscRenderer.CENTER_HOLE_RADIUS * 1.125f * (1f - closeProgress)
        if (radius != notchRadius) {
            notchRadius = radius
            cover.shapeAppearanceModel = cover.shapeAppearanceModel.toBuilder()
                .setRightEdge(PlayerCoverNotchEdge(radius)).build()
        }
    }

    override fun onDetachedFromWindow() {
        resetTransition()
        super.onDetachedFromWindow()
    }

    override fun onVisibilityAggregated(isVisible: Boolean) {
        super.onVisibilityAggregated(isVisible)
        if (!isVisible) resetTransition()
    }

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
        applyComposition()
    }

    override fun generateDefaultLayoutParams() = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    override fun generateLayoutParams(attrs: AttributeSet) = LayoutParams(context, attrs)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
