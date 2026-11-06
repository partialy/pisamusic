package cn.partialy.pm.ui.player.background

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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal class PlayerBackgroundController(
    private val legacyBackground: ImageView,
    private val flowingBackground: FlowingCoverBackgroundView,
    private val scope: CoroutineScope,
    private val scrim: View? = null,
    private val paletteExtractor: CoverFlowPaletteExtractor = CoverFlowPaletteExtractor(),
) {
    private var requestDisposable: Disposable? = null
    private var extractionJob: Job? = null
    private var blurJob: Job? = null
    private var requestVersion = 0L
    private var currentSongKey: String? = null
    private var currentDrawable: Drawable? = null
    private var dynamicEnabled = true
    private var started = false
    private val paletteCache = LruCache<String, CoverFlowPalette>(16)

    private var extractionSongKey: String? = null
    private var extractionDrawable: Drawable? = null
    private var hasVisiblePalette = false
    private var released = false

    init {
        applyDynamicMode()
    }

    fun bind(songKey: String, model: Any?) {
        if (released) return

        requestVersion++
        currentSongKey = songKey
        requestDisposable?.dispose()
        requestDisposable = null
        cancelPaletteExtraction()
        currentDrawable = null
        blurJob?.cancel()

        submitFallbackPaletteIfNeeded(songKey)
        applyBlurBackground(songKey, model)
    }

    /** 空歌曲预览直接使用默认色板，不把 App 图标误作封面提色。 */
    fun bindFallback(songKey: String = "background-preview-fallback") {
        if (released) return
        requestVersion++
        currentSongKey = songKey
        requestDisposable?.dispose()
        requestDisposable = null
        cancelPaletteExtraction()
        blurJob?.cancel()
        currentDrawable = null
        legacyBackground.setImageDrawable(null)
        flowingBackground.submitPalette(FALLBACK_PALETTE, songKey.hashCode().toLong(), hasVisiblePalette)
        hasVisiblePalette = true
        startDynamicMotionIfEligible()
    }

    fun setDynamicEnabled(enabled: Boolean) {
        if (released) return

        dynamicEnabled = enabled
        if (enabled) blurJob?.cancel()
        if (enabled) {
            applyDynamicMode()
            ensureDynamicPaletteForCurrentDrawable()
            startDynamicMotionIfEligible()
        } else {
            cancelPaletteExtraction()
            applyLegacyMode()
        }
    }

    fun setConfig(config: PlayerFlowBackgroundConfig) {
        flowingBackground.setConfig(config)
    }

    fun onStart() {
        if (released) return

        started = true
        startDynamicMotionIfEligible()
    }

    fun onStop() {
        started = false
        flowingBackground.stopMotion()

    }

    fun release() {
        if (released) return

        released = true
        started = false
        currentSongKey = null
        requestDisposable?.dispose()
        requestDisposable = null
        cancelPaletteExtraction()

        flowingBackground.release()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            legacyBackground.setRenderEffect(null)
        }
        blurJob?.cancel()
        legacyBackground.setImageDrawable(null)
        currentDrawable = null
        hasVisiblePalette = false
        paletteCache.evictAll()
    }

    private fun applyBlurBackground(capturedSongKey: String, model: Any?) {
        val capturedVersion = requestVersion
        val backgroundModel = model ?: R.drawable.ic_pm_icon
        val requestBuilder = ImageRequest.Builder(legacyBackground.context)
            .data(backgroundModel)
            .placeholder(R.drawable.ic_pm_icon)
            .error(R.drawable.ic_pm_icon)
            .fallback(R.drawable.ic_pm_icon)
            // Palette must read pixels from the resolved cover on a software Canvas.
            .allowHardware(false)

        val request = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            legacyBackground.setRenderEffect(
                RenderEffect.createBlurEffect(60f, 60f, Shader.TileMode.CLAMP),
            )
            requestBuilder
                .crossfade(true)
                .target(GuardedImageViewTarget(capturedSongKey))
                .listener(object : ImageRequest.Listener {
                    override fun onSuccess(request: ImageRequest, result: SuccessResult) {
                        if (capturedSongKey != currentSongKey || capturedVersion != requestVersion || released) return
                        onDrawableResolved(capturedSongKey, result.drawable, renderLegacyBlur = false)
                    }

                    override fun onError(request: ImageRequest, result: ErrorResult) {
                        if (capturedSongKey != currentSongKey || capturedVersion != requestVersion || released) return
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
                        if (capturedSongKey != currentSongKey || capturedVersion != requestVersion || released) return@target
                        applyLegacyBlurBackground(placeholder)
                    },
                    onSuccess = { drawable ->
                        if (capturedSongKey != currentSongKey || capturedVersion != requestVersion || released) return@target
                        onDrawableResolved(capturedSongKey, drawable, renderLegacyBlur = true)
                    },
                    onError = { drawable ->
                        if (capturedSongKey != currentSongKey || capturedVersion != requestVersion || released) return@target
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
            val palette = try {
                withContext(Dispatchers.Default) {
                    paletteExtractor.extract(drawable)
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                FALLBACK_PALETTE
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
        legacyBackground.visibility = View.VISIBLE
        legacyBackground.alpha = 1f
        legacyBackground.scaleType = ImageView.ScaleType.CENTER_CROP
        legacyBackground.scaleX = 1.25f
        legacyBackground.scaleY = 1.25f
        scrim?.setBackgroundColor(0x80000000.toInt())
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) applyLegacyBlurBackground(currentDrawable)
    }

    private fun applyDynamicMode() {
        flowingBackground.visibility = View.VISIBLE
        legacyBackground.visibility = View.INVISIBLE
        legacyBackground.alpha = 0f
        scrim?.setBackgroundColor(android.graphics.Color.TRANSPARENT)
    }

    private fun startDynamicMotionIfEligible() {
        if (started && dynamicEnabled && !released) flowingBackground.startMotion()
        else flowingBackground.stopMotion()
    }

    private fun cancelPaletteExtraction() {
        extractionJob?.cancel()
        extractionJob = null
        extractionSongKey = null
        extractionDrawable = null
    }

    private fun applyLegacyBlurBackground(drawable: Drawable?) {
        drawable ?: return
        if (dynamicEnabled || released) return
        blurJob?.cancel()
        val capturedVersion = requestVersion
        blurJob = scope.launch {
            var prepared: Bitmap? = null
            var adopted = false
            try {
                withContext(Dispatchers.Default) {
                    val bitmap = drawable.toBitmap(width = 256, height = 256, config = Bitmap.Config.ARGB_8888)
                    try { prepared = blurBitmapWithRenderScript(bitmap, 25f) }
                    finally { if (bitmap !== (drawable as? android.graphics.drawable.BitmapDrawable)?.bitmap) bitmap.recycle() }
                }
                if (capturedVersion == requestVersion && !released && !dynamicEnabled) {
                    legacyBackground.setImageBitmap(prepared)
                    adopted = true
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                if (capturedVersion == requestVersion && !released && !dynamicEnabled) legacyBackground.setImageDrawable(drawable)
            } finally {
                if (!adopted) prepared?.recycle()
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun blurBitmapWithRenderScript(source: Bitmap, radius: Float): Bitmap {
        val input = Bitmap.createScaledBitmap(source, 32, 32, true)
        val output = Bitmap.createBitmap(input.width, input.height, Bitmap.Config.ARGB_8888)
        val rs = RenderScript.create(legacyBackground.context)
        var script: ScriptIntrinsicBlur? = null
        var allocIn: Allocation? = null
        var allocOut: Allocation? = null
        try {
            script = ScriptIntrinsicBlur.create(rs, Element.U8_4(rs))
            allocIn = Allocation.createFromBitmap(rs, input)
            allocOut = Allocation.createFromBitmap(rs, output)
            script.setRadius(radius)
            script.setInput(allocIn)
            script.forEach(allocOut)
            allocOut.copyTo(output)
            return output
        } catch (failure: Exception) {
            output.recycle()
            throw failure
        } finally {
            script?.destroy()
            allocIn?.destroy()
            allocOut?.destroy()
            rs.destroy()
            if (input !== source) input.recycle()
        }
    }

    private inner class GuardedImageViewTarget(
        private val capturedSongKey: String,
    ) : ImageViewTarget(legacyBackground) {
        private val capturedVersion = requestVersion
        override fun onStart(placeholder: Drawable?) {
            if (capturedSongKey != currentSongKey || capturedVersion != requestVersion || released) return
            super.onStart(placeholder)
        }

        override fun onSuccess(result: Drawable) {
            if (capturedSongKey != currentSongKey || capturedVersion != requestVersion || released) return
            super.onSuccess(result)
        }

        override fun onError(error: Drawable?) {
            if (capturedSongKey != currentSongKey || capturedVersion != requestVersion || released) return
            super.onError(error)
        }
    }

    private companion object {
        val FALLBACK_PALETTE = CoverFlowPaletteRules.fromCandidates(emptyList())
    }
}
