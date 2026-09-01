package cn.partialy.pm.ui.player.background

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.View
import android.widget.FrameLayout
import androidx.core.graphics.ColorUtils
import androidx.interpolator.view.animation.FastOutSlowInInterpolator

internal class FlowingCoverBackgroundView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr) {

    private data class LayerBank(
        val container: FrameLayout,
        val blobs: List<View>,
        var animators: List<AnimatorSet> = emptyList(),
        var motionSpecs: List<FlowingCoverMotionSpec> = emptyList(),
    )

    private val banks = List(BANK_COUNT) { createLayerBank() }
    private var activeBank: LayerBank? = null
    private var transitioningBank: LayerBank? = null
    private var crossfadeAnimator: AnimatorSet? = null
    private var isMotionRequested = false
    private var isReleased = false

    init {
        clipChildren = false
        clipToPadding = false
        banks.forEach { bank ->
            addView(bank.container)
            bank.container.alpha = 0f
            bank.container.visibility = INVISIBLE
        }
    }

    fun submitPalette(palette: CoverFlowPalette, seed: Long, animateTransition: Boolean) {
        if (isReleased) return

        settleLatestTransition()
        val outgoingBank = activeBank
        val incomingBank = banks.firstOrNull { it !== outgoingBank } ?: return
        populateBank(incomingBank, palette, seed)
        visibility = VISIBLE

        if (outgoingBank == null) {
            incomingBank.container.alpha = 1f
            incomingBank.container.visibility = VISIBLE
            activeBank = incomingBank
            startVisibleMotionIfEligible()
            return
        }

        if (!animateTransition || !ValueAnimator.areAnimatorsEnabled()) {
            outgoingBank.container.alpha = 0f
            outgoingBank.container.visibility = INVISIBLE
            incomingBank.container.alpha = 1f
            incomingBank.container.visibility = VISIBLE
            activeBank = incomingBank
            startVisibleMotionIfEligible()
            return
        }

        incomingBank.container.alpha = 0f
        incomingBank.container.visibility = VISIBLE
        transitioningBank = incomingBank
        startVisibleMotionIfEligible()
        crossfadeAnimator = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(outgoingBank.container, View.ALPHA, outgoingBank.container.alpha, 0f),
                ObjectAnimator.ofFloat(incomingBank.container, View.ALPHA, 0f, 1f),
            )
            duration = PALETTE_CROSSFADE_DURATION_MS
            interpolator = FastOutSlowInInterpolator()
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    if (crossfadeAnimator !== this@apply) return
                    outgoingBank.container.alpha = 0f
                    outgoingBank.container.visibility = INVISIBLE
                    incomingBank.container.alpha = 1f
                    activeBank = incomingBank
                    transitioningBank = null
                    crossfadeAnimator?.removeAllListeners()
                    crossfadeAnimator = null
                }
            })
            start()
        }
    }

    fun startMotion() {
        if (isReleased) return
        isMotionRequested = true
        startVisibleMotionIfEligible()
    }

    fun stopMotion() {
        isMotionRequested = false
        banks.forEach(::cancelBankMotion)
    }

    fun release() {
        if (isReleased) return
        isReleased = true
        isMotionRequested = false
        cancelCrossfade()
        transitioningBank = null
        activeBank = null
        banks.forEach { bank ->
            cancelBankMotion(bank)
            bank.motionSpecs = emptyList()
            bank.blobs.forEach { blob ->
                resetBlobTransform(blob)
                blob.background = null
            }
            bank.container.background = null
            bank.container.alpha = 0f
            bank.container.visibility = INVISIBLE
        }
        visibility = GONE
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        startVisibleMotionIfEligible()
    }

    override fun onDetachedFromWindow() {
        settleLatestTransition()
        banks.forEach(::cancelBankMotion)
        super.onDetachedFromWindow()
    }

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        super.onSizeChanged(width, height, oldWidth, oldHeight)
        if (width != oldWidth || height != oldHeight) {
            banks.forEach(::cancelBankMotion)
            startVisibleMotionIfEligible()
        }
    }

    private fun createLayerBank(): LayerBank {
        val container = FrameLayout(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            clipChildren = false
            clipToPadding = false
        }
        val blobs = List(BLOB_COUNT) { createBlobView() }
        blobs.forEach(container::addView)
        return LayerBank(container = container, blobs = blobs)
    }

    private fun createBlobView(): View = View(context).apply {
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    private fun blobDrawable(color: Int, index: Int): GradientDrawable =
        GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(
                ColorUtils.setAlphaComponent(color, BLOB_ALPHAS[index]),
                ColorUtils.setAlphaComponent(color, 0),
            ),
        ).apply {
            gradientType = GradientDrawable.RADIAL_GRADIENT
            gradientRadius = resources.displayMetrics.widthPixels * (0.72f + index * 0.08f)
            setGradientCenter(BLOB_CENTER_X[index], BLOB_CENTER_Y[index])
        }

    private fun populateBank(bank: LayerBank, palette: CoverFlowPalette, seed: Long) {
        cancelBankMotion(bank)
        bank.container.setBackgroundColor(palette.baseColor)
        bank.blobs.forEachIndexed { index, blob ->
            resetBlobTransform(blob)
            blob.background = blobDrawable(palette.blobColors[index], index)
        }
        bank.motionSpecs = FlowingCoverMotionRules.specs(seed)
        bank.container.alpha = 0f
        bank.container.visibility = VISIBLE
    }

    private fun startVisibleMotionIfEligible() {
        if (!canStartMotion()) return
        banks.filter { it.container.visibility == VISIBLE }.forEach(::startBankMotion)
    }

    private fun canStartMotion(): Boolean =
        isMotionRequested && isAttachedToWindow && width > 0 && ValueAnimator.areAnimatorsEnabled()

    private fun startBankMotion(bank: LayerBank) {
        if (bank.animators.isNotEmpty() || bank.motionSpecs.size != BLOB_COUNT) return
        bank.animators = bank.blobs.zip(bank.motionSpecs).map { (blob, spec) ->
            AnimatorSet().apply {
                playTogether(
                    infinitePropertyAnimator(blob, View.TRANSLATION_X, blob.translationX, width * spec.translationXFraction, spec.durationMs),
                    infinitePropertyAnimator(blob, View.TRANSLATION_Y, blob.translationY, height * spec.translationYFraction, spec.durationMs),
                    infinitePropertyAnimator(blob, View.SCALE_X, blob.scaleX, spec.scale, spec.durationMs),
                    infinitePropertyAnimator(blob, View.SCALE_Y, blob.scaleY, spec.scale, spec.durationMs),
                    infinitePropertyAnimator(blob, View.ROTATION, blob.rotation, spec.rotationDegrees, spec.durationMs),
                )
                start()
            }
        }
    }

    private fun infinitePropertyAnimator(
        view: View,
        property: android.util.Property<View, Float>,
        start: Float,
        end: Float,
        durationMs: Long,
    ): ObjectAnimator = ObjectAnimator.ofFloat(view, property, start, end).apply {
        duration = durationMs
        repeatMode = ValueAnimator.REVERSE
        repeatCount = ValueAnimator.INFINITE
    }

    private fun cancelBankMotion(bank: LayerBank) {
        bank.animators.forEach { animator ->
            animator.removeAllListeners()
            animator.cancel()
        }
        bank.animators = emptyList()
    }

    private fun settleLatestTransition() {
        val latestBank = transitioningBank ?: return
        cancelCrossfade()
        activeBank?.let { previousBank ->
            previousBank.container.alpha = 0f
            previousBank.container.visibility = INVISIBLE
        }
        latestBank.container.alpha = 1f
        latestBank.container.visibility = VISIBLE
        activeBank = latestBank
        transitioningBank = null
    }

    private fun cancelCrossfade() {
        crossfadeAnimator?.removeAllListeners()
        crossfadeAnimator?.cancel()
        crossfadeAnimator = null
    }

    private fun resetBlobTransform(blob: View) {
        blob.translationX = 0f
        blob.translationY = 0f
        blob.scaleX = 1f
        blob.scaleY = 1f
        blob.rotation = 0f
    }

    private companion object {
        const val BANK_COUNT = 2
        const val BLOB_COUNT = 4
        const val PALETTE_CROSSFADE_DURATION_MS = 900L

        val BLOB_ALPHAS = intArrayOf(150, 132, 118, 104)
        val BLOB_CENTER_X = floatArrayOf(0.18f, 0.78f, 0.26f, 0.72f)
        val BLOB_CENTER_Y = floatArrayOf(0.22f, 0.28f, 0.78f, 0.74f)
    }
}
