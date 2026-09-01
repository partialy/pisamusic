package cn.partialy.pm.ui.player.background

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.graphics.Bitmap
import android.graphics.RenderEffect
import android.graphics.Shader
import android.graphics.drawable.Drawable
import android.os.Build
import android.renderscript.Allocation
import android.renderscript.Element
import android.renderscript.RenderScript
import android.renderscript.ScriptIntrinsicBlur
import android.util.LruCache
import android.view.View
import android.widget.ImageView
import androidx.core.graphics.drawable.toBitmap
import cn.partialy.pm.R
import coil.imageLoader
import coil.request.Disposable
import coil.request.ErrorResult
import coil.request.ImageRequest
import coil.request.SuccessResult
import coil.target.ImageViewTarget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal class PlayerBackgroundController(
    private val legacyBackground: ImageView,
    private val flowingBackground: FlowingCoverBackgroundView,
    private val scope: CoroutineScope,
    private val paletteExtractor: CoverFlowPaletteExtractor = CoverFlowPaletteExtractor(),
) {
    private var requestDisposable: Disposable? = null
    private var extractionJob: Job? = null
    private var textureAnimator: AnimatorSet? = null
    private var currentSongKey: String? = null
    private var currentDrawable: Drawable? = null
    private var dynamicEnabled = true
    private var started = false
    private val paletteCache = LruCache<String, CoverFlowPalette>(16)

    private var extractionSongKey: String? = null
    private var extractionDrawable: Drawable? = null
    private var pendingTextureLayoutListener: View.OnLayoutChangeListener? = null
    private var hasVisiblePalette = false
    private var released = false

    init {
        applyDynamicMode()
    }

    fun bind(songKey: String, model: Any?) {
        if (released) return

        currentSongKey = songKey
        requestDisposable?.dispose()
        requestDisposable = null
        cancelPaletteExtraction()
        currentDrawable = null
        restartPendingTextureMotionForCurrentSong()

        submitFallbackPaletteIfNeeded(songKey)
        applyBlurBackground(songKey, model)
    }

    fun setDynamicEnabled(enabled: Boolean) {
        if (released) return

        dynamicEnabled = enabled
        if (enabled) {
            applyDynamicMode()
            ensureDynamicPaletteForCurrentDrawable()
            startDynamicMotionIfEligible()
        } else {
            cancelPaletteExtraction()
            applyLegacyMode()
        }
    }

    fun onStart() {
        if (released) return

        started = true
        startDynamicMotionIfEligible()
    }

    fun onStop() {
        started = false
        flowingBackground.stopMotion()
        stopTextureMotion(resetTransform = false)
    }

    fun release() {
        if (released) return

        released = true
        started = false
        currentSongKey = null
        requestDisposable?.dispose()
        requestDisposable = null
        cancelPaletteExtraction()
        stopTextureMotion(resetTransform = false)
        flowingBackground.release()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            legacyBackground.setRenderEffect(null)
        }
        currentDrawable = null
        hasVisiblePalette = false
        paletteCache.evictAll()
    }

    private fun applyBlurBackground(capturedSongKey: String, model: Any?) {
        val backgroundModel = model ?: R.drawable.ic_pm_icon
        val requestBuilder = ImageRequest.Builder(legacyBackground.context)
            .data(backgroundModel)
            .placeholder(R.drawable.ic_pm_icon)
            .error(R.drawable.ic_pm_icon)
            .fallback(R.drawable.ic_pm_icon)

        val request = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            legacyBackground.setRenderEffect(
                RenderEffect.createBlurEffect(400f, 400f, Shader.TileMode.CLAMP),
            )
            requestBuilder
                .crossfade(true)
                .target(GuardedImageViewTarget(capturedSongKey))
                .listener(object : ImageRequest.Listener {
                    override fun onSuccess(request: ImageRequest, result: SuccessResult) {
                        if (capturedSongKey != currentSongKey || released) return
                        onDrawableResolved(capturedSongKey, result.drawable, renderLegacyBlur = false)
                    }

                    override fun onError(request: ImageRequest, result: ErrorResult) {
                        if (capturedSongKey != currentSongKey || released) return
                        result.drawable?.let { drawable ->
                            onDrawableResolved(capturedSongKey, drawable, renderLegacyBlur = false)
                        }
                    }
                })
                .build()
        } else {
            requestBuilder
                .target(
                    onStart = { placeholder ->
                        if (capturedSongKey != currentSongKey || released) return@target
                        applyLegacyBlurBackground(placeholder)
                    },
                    onSuccess = { drawable ->
                        if (capturedSongKey != currentSongKey || released) return@target
                        onDrawableResolved(capturedSongKey, drawable, renderLegacyBlur = true)
                    },
                    onError = { drawable ->
                        if (capturedSongKey != currentSongKey || released) return@target
                        drawable?.let {
                            onDrawableResolved(capturedSongKey, it, renderLegacyBlur = true)
                        }
                    },
                )
                .build()
        }

        requestDisposable = legacyBackground.context.imageLoader.enqueue(request)
    }

    private fun onDrawableResolved(
        capturedSongKey: String,
        drawable: Drawable,
        renderLegacyBlur: Boolean,
    ) {
        if (capturedSongKey != currentSongKey || released) return

        currentDrawable = drawable
        if (renderLegacyBlur) {
            applyLegacyBlurBackground(drawable)
        }
        if (!dynamicEnabled) return
        ensureDynamicPaletteForCurrentDrawable()
    }

    private fun ensureDynamicPaletteForCurrentDrawable() {
        if (!dynamicEnabled || released) return

        val capturedSongKey = currentSongKey ?: return
        paletteCache.get(capturedSongKey)?.let { palette ->
            if (capturedSongKey != currentSongKey || released) return
            submitPalette(capturedSongKey, palette)
            return
        }

        val drawable = currentDrawable ?: return
        if (
            extractionJob?.isActive == true &&
            extractionSongKey == capturedSongKey &&
            extractionDrawable === drawable
        ) {
            return
        }

        cancelPaletteExtraction()
        extractionSongKey = capturedSongKey
        extractionDrawable = drawable
        extractionJob = scope.launch(Dispatchers.Main.immediate) {
            val palette = withContext(Dispatchers.Default) {
                paletteExtractor.extract(drawable)
            }
            if (capturedSongKey != currentSongKey || !dynamicEnabled || released) return@launch
            paletteCache.put(capturedSongKey, palette)
            if (capturedSongKey != currentSongKey || !dynamicEnabled || released) return@launch
            submitPalette(capturedSongKey, palette)
        }
    }

    private fun submitFallbackPaletteIfNeeded(capturedSongKey: String) {
        if (hasVisiblePalette) return
        if (capturedSongKey != currentSongKey || released) return

        flowingBackground.submitPalette(
            palette = FALLBACK_PALETTE,
            seed = capturedSongKey.hashCode().toLong(),
            animateTransition = false,
        )
        hasVisiblePalette = true
        if (!dynamicEnabled) {
            flowingBackground.visibility = View.GONE
        }
    }

    private fun submitPalette(capturedSongKey: String, palette: CoverFlowPalette) {
        if (capturedSongKey != currentSongKey || !dynamicEnabled || released) return

        flowingBackground.submitPalette(
            palette = palette,
            seed = capturedSongKey.hashCode().toLong(),
            animateTransition = hasVisiblePalette,
        )
        hasVisiblePalette = true
        startDynamicMotionIfEligible()
    }

    private fun applyLegacyMode() {
        flowingBackground.visibility = View.GONE
        flowingBackground.stopMotion()
        stopTextureMotion(resetTransform = true)
    }

    private fun applyDynamicMode() {
        flowingBackground.visibility = View.VISIBLE
        legacyBackground.alpha = 0.22f
        legacyBackground.scaleX = 1.12f
        legacyBackground.scaleY = 1.12f
    }

    private fun startDynamicMotionIfEligible() {
        if (!started || !dynamicEnabled || !ValueAnimator.areAnimatorsEnabled() || released) {
            flowingBackground.stopMotion()
            stopTextureMotion(resetTransform = false)
            return
        }

        flowingBackground.startMotion()
        startTextureMotion()
    }

    private fun startTextureMotion() {
        if (textureAnimator != null || pendingTextureLayoutListener != null) return
        if (legacyBackground.width <= 0 || legacyBackground.height <= 0) {
            val capturedSongKey = currentSongKey
            val layoutListener = object : View.OnLayoutChangeListener {
                override fun onLayoutChange(
                    view: View,
                    left: Int,
                    top: Int,
                    right: Int,
                    bottom: Int,
                    oldLeft: Int,
                    oldTop: Int,
                    oldRight: Int,
                    oldBottom: Int,
                ) {
                    if (view.width <= 0 || view.height <= 0) return
                    view.removeOnLayoutChangeListener(this)
                    if (pendingTextureLayoutListener !== this) return
                    pendingTextureLayoutListener = null
                    if (capturedSongKey != currentSongKey || released) return
                    if (!started || !dynamicEnabled || !ValueAnimator.areAnimatorsEnabled()) return
                    createAndStartTextureAnimator()
                }
            }
            pendingTextureLayoutListener = layoutListener
            legacyBackground.addOnLayoutChangeListener(layoutListener)
            return
        }

        createAndStartTextureAnimator()
    }

    private fun createAndStartTextureAnimator() {
        if (textureAnimator != null) return
        val width = legacyBackground.width.toFloat()
        val height = legacyBackground.height.toFloat()
        if (width <= 0f || height <= 0f) return

        textureAnimator = AnimatorSet().apply {
            playTogether(
                repeatingAnimator(
                    property = View.TRANSLATION_X,
                    from = -0.035f * width,
                    to = 0.035f * width,
                    durationMs = 34_000L,
                ),
                repeatingAnimator(
                    property = View.TRANSLATION_Y,
                    from = -0.025f * height,
                    to = 0.025f * height,
                    durationMs = 41_000L,
                ),
                repeatingAnimator(
                    property = View.ROTATION,
                    from = -1.2f,
                    to = 1.2f,
                    durationMs = 47_000L,
                ),
                repeatingAnimator(
                    property = View.SCALE_X,
                    from = 1.10f,
                    to = 1.16f,
                    durationMs = 53_000L,
                ),
                repeatingAnimator(
                    property = View.SCALE_Y,
                    from = 1.10f,
                    to = 1.16f,
                    durationMs = 53_000L,
                ),
            )
            start()
        }
    }

    private fun restartPendingTextureMotionForCurrentSong() {
        val pendingListener = pendingTextureLayoutListener ?: return
        legacyBackground.removeOnLayoutChangeListener(pendingListener)
        pendingTextureLayoutListener = null
        startDynamicMotionIfEligible()
    }

    private fun repeatingAnimator(
        property: android.util.Property<View, Float>,
        from: Float,
        to: Float,
        durationMs: Long,
    ): ObjectAnimator = ObjectAnimator.ofFloat(legacyBackground, property, from, to).apply {
        duration = durationMs
        repeatMode = ValueAnimator.REVERSE
        repeatCount = ValueAnimator.INFINITE
    }

    private fun stopTextureMotion(resetTransform: Boolean) {
        pendingTextureLayoutListener?.let(legacyBackground::removeOnLayoutChangeListener)
        pendingTextureLayoutListener = null
        textureAnimator?.cancel()
        textureAnimator = null
        if (!resetTransform) return

        legacyBackground.animate().cancel()
        legacyBackground.alpha = 1f
        legacyBackground.translationX = 0f
        legacyBackground.translationY = 0f
        legacyBackground.scaleX = 1f
        legacyBackground.scaleY = 1f
        legacyBackground.rotation = 0f
    }

    private fun cancelPaletteExtraction() {
        extractionJob?.cancel()
        extractionJob = null
        extractionSongKey = null
        extractionDrawable = null
    }

    private fun applyLegacyBlurBackground(drawable: Drawable?) {
        drawable ?: return
        val bitmap = drawable.toBitmap()
        val blurred = blurBitmapWithRenderScript(bitmap, 25f)
        legacyBackground.setImageBitmap(blurred)
    }

    @Suppress("DEPRECATION")
    private fun blurBitmapWithRenderScript(source: Bitmap, radius: Float): Bitmap {
        val scaledWidth = (source.width / 8).coerceAtLeast(1)
        val scaledHeight = (source.height / 8).coerceAtLeast(1)
        val input = Bitmap.createScaledBitmap(source, scaledWidth, scaledHeight, true)
        val output = Bitmap.createBitmap(input.width, input.height, Bitmap.Config.ARGB_8888)

        val rs = RenderScript.create(legacyBackground.context)
        val script = ScriptIntrinsicBlur.create(rs, Element.U8_4(rs))
        val allocIn = Allocation.createFromBitmap(rs, input)
        val allocOut = Allocation.createFromBitmap(rs, output)
        script.setRadius(radius)
        script.setInput(allocIn)
        script.forEach(allocOut)
        allocOut.copyTo(output)

        script.destroy()
        allocIn.destroy()
        allocOut.destroy()
        rs.destroy()

        return output
    }

    private inner class GuardedImageViewTarget(
        private val capturedSongKey: String,
    ) : ImageViewTarget(legacyBackground) {
        override fun onStart(placeholder: Drawable?) {
            if (capturedSongKey != currentSongKey || released) return
            super.onStart(placeholder)
        }

        override fun onSuccess(result: Drawable) {
            if (capturedSongKey != currentSongKey || released) return
            super.onSuccess(result)
        }

        override fun onError(error: Drawable?) {
            if (capturedSongKey != currentSongKey || released) return
            super.onError(error)
        }
    }

    private companion object {
        val FALLBACK_PALETTE = CoverFlowPaletteRules.fromCandidates(emptyList())
    }
}
