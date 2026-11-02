package cn.partialy.pm.ui.player

import android.animation.ValueAnimator
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.View
import android.view.ViewTreeObserver
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

/** Sheet 专属无声预览；调用方合并宿主、IME 可见性，关闭时必须 release。 */
class LyricPreviewController(
    normalLyrics: RecyclerView,
    karaokeLyrics: KaraokeLyricsView,
) {
    private var normalLyrics: RecyclerView? = normalLyrics
    private var karaokeLyrics: KaraokeLyricsView? = karaokeLyrics
    private val adapter = LyricsAdapter()
    private val handler = Handler(Looper.getMainLooper())
    private var style = LyricDisplayStyle.DEFAULT
    private var useWordLyrics = false
    private var visible = false
    private var released = false
    private var animationsEnabled = true
    private var accumulatedMs = 0L
    private var anchorUptimeMs = 0L
    private var currentIndex = -1
    private var lastPositionMs = -1L
    private var needsKaraokeBind = true
    private var pendingCenter = false
    private var centerObserver: ViewTreeObserver? = null
    private val centerListener = ViewTreeObserver.OnPreDrawListener {
        val view = this.normalLyrics
        if (!pendingCenter || view == null || !visible || useWordLyrics || released) {
            cancelPendingCenter()
            true
        } else if (view.isLayoutRequested || view.isComputingLayout || view.height == 0) {
            true
        } else {
            centerAfterLayout(view)
        }
    }

    private val layoutListener = View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
        if (visible && !useWordLyrics && !released) requestCenter()
    }

    private val tick = object : Runnable {
        override fun run() {
            if (!visible || released || !animationsEnabled) return
            render()
            handler.postDelayed(this, TICK_MS)
        }
    }

    init {
        normalLyrics.layoutManager = LinearLayoutManager(normalLyrics.context)
        normalLyrics.adapter = adapter
        normalLyrics.itemAnimator = null
        normalLyrics.isNestedScrollingEnabled = false
        normalLyrics.clipToPadding = false
        normalLyrics.addOnLayoutChangeListener(layoutListener)
        adapter.submitList(LyricPreviewSamples.lines) {
            if (!released && visible && !useWordLyrics) requestCenter()
        }
        karaokeLyrics.stopAnimations()
    }

    fun applyStyle(style: LyricDisplayStyle, useWordLyrics: Boolean) {
        if (released) return
        val styleChanged = this.style != style
        val modeChanged = this.useWordLyrics != useWordLyrics
        this.style = style
        this.useWordLyrics = useWordLyrics
        if (styleChanged) adapter.setDisplayStyle(style)
        if (modeChanged || styleChanged) needsKaraokeBind = true
        if (modeChanged) karaokeLyrics?.stopAnimations()
        updateRendererVisibility()
        if (visible) {
            render()
            if (!useWordLyrics) requestCenter()
        }
    }

    fun setVisible(visible: Boolean) {
        if (released) return
        val now = SystemClock.uptimeMillis()
        if (this.visible && animationsEnabled) accumulatedMs += now - anchorUptimeMs
        handler.removeCallbacks(tick)
        karaokeLyrics?.stopAnimations()
        normalLyrics?.stopScroll()
        cancelPendingCenter()
        this.visible = visible
        animationsEnabled = ValueAnimator.areAnimatorsEnabled()
        if (visible && !animationsEnabled && lastPositionMs < 0L) {
            // 无动画首次打开时给出有逐字着色的中间行静态样本。
            accumulatedMs = 3_800L
        }
        anchorUptimeMs = now
        needsKaraokeBind = true
        updateRendererVisibility()
        if (visible) {
            render()
            if (!useWordLyrics) requestCenter()
            if (animationsEnabled) handler.postDelayed(tick, TICK_MS)
        }
    }

    fun release() {
        if (released) return
        setVisible(false)
        released = true
        handler.removeCallbacksAndMessages(null)
        normalLyrics?.removeOnLayoutChangeListener(layoutListener)
        normalLyrics?.adapter = null
        normalLyrics = null
        karaokeLyrics = null
    }

    private fun render() {
        val position = LyricPreviewSamples.positionAt(
            accumulatedMs + if (animationsEnabled) SystemClock.uptimeMillis() - anchorUptimeMs else 0L,
        )
        val index = LyricPreviewSamples.indexAt(position)
        val lineChanged = index != currentIndex
        val wrapped = lastPositionMs > position
        currentIndex = index
        lastPositionMs = position
        if (lineChanged) {
            adapter.setCurrentIndex(index)
            if (!useWordLyrics) requestCenter()
        }
        if (useWordLyrics && (needsKaraokeBind || lineChanged || wrapped)) {
            karaokeLyrics?.bind(
                lines = LyricPreviewSamples.lines,
                currentIndex = index,
                positionMs = position,
                isPlaying = animationsEnabled,
                style = style,
                animateTransitions = animationsEnabled,
            )
            needsKaraokeBind = false
        }
    }

    private fun updateRendererVisibility() {
        if (!visible || useWordLyrics) cancelPendingCenter()
        normalLyrics?.visibility = if (visible && !useWordLyrics) View.VISIBLE else View.GONE
        karaokeLyrics?.visibility = if (visible && useWordLyrics) View.VISIBLE else View.GONE
    }

    private fun requestCenter() {
        val view = normalLyrics ?: return
        if (!visible || useWordLyrics || released) return
        pendingCenter = true
        if (centerObserver?.isAlive != true) {
            centerObserver = view.viewTreeObserver.also { it.addOnPreDrawListener(centerListener) }
        }
        view.invalidate()
    }

    private fun centerAfterLayout(view: RecyclerView): Boolean {
        if (currentIndex < 0 || adapter.itemCount == 0) return true
        val manager = view.layoutManager as? LinearLayoutManager ?: return true
        val row = manager.findViewByPosition(currentIndex)
        if (row == null) {
            manager.scrollToPositionWithOffset(currentIndex, 0)
            return false
        }
        // 按当前行新测量高度预留两端空间，同时保留至少 1px 布局视口。
        val padding = ((view.height - row.height) / 2).coerceIn(0, (view.height - 1) / 2)
        if (view.paddingTop != padding || view.paddingBottom != padding) {
            view.setPadding(view.paddingLeft, padding, view.paddingRight, padding)
            return false
        }
        val delta = row.top + row.height / 2 - view.height / 2
        if (delta != 0) view.scrollBy(0, delta)
        cancelPendingCenter()
        return true
    }

    private fun cancelPendingCenter() {
        pendingCenter = false
        centerObserver?.takeIf { it.isAlive }?.removeOnPreDrawListener(centerListener)
        centerObserver = null
    }

    private companion object {
        const val TICK_MS = 80L
    }
}
