package cn.partialy.pm.statusbarlyric

import android.content.Context
import android.content.SharedPreferences
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.lyric.LyricParser
import cn.partialy.pm.lyric.LyricRepository
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.utils.LyricDisplayPrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToInt

@Singleton
class StatusBarLyricOverlayController @Inject constructor(
    @ApplicationContext private val context: Context,
    private val musicController: MusicController,
    private val lyricRepository: LyricRepository,
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var scope: CoroutineScope? = null
    private var config = StatusBarLyricPrefs.read(context)
    private var overlayView: StatusBarLyricView? = null
    private var latestLines: List<LyricLine> = emptyList()
    private var latestPositionMs: Long = 0L
    private var latestPlaying = false
    private var latestSongKey: String? = null
    private var loadJob: Job? = null
    private var serviceActive = false
    private var settingsPreviewActive = false

    private val prefListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
        config = StatusBarLyricPrefs.read(context)
        updateOverlayLayout()
        render()
    }

    fun start() {
        serviceActive = true
        ensureStarted()
    }

    fun stop() {
        serviceActive = false
        shutdownIfIdle()
    }

    fun showSettingsPreview() {
        settingsPreviewActive = true
        ensureStarted()
        render()
    }

    fun hideSettingsPreview() {
        settingsPreviewActive = false
        if (shutdownIfIdle()) return
        render()
    }

    fun showWidthBounds() {
        if (!Settings.canDrawOverlays(context)) return
        render()
        overlayView?.showBounds()
    }

    private fun ensureStarted() {
        if (scope != null) return
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        StatusBarLyricPrefs.prefs(context).registerOnSharedPreferenceChangeListener(prefListener)
        observePlayback()
    }

    private fun shutdownIfIdle(): Boolean {
        if (serviceActive || settingsPreviewActive) return false
        StatusBarLyricPrefs.prefs(context).unregisterOnSharedPreferenceChangeListener(prefListener)
        loadJob?.cancel()
        loadJob = null
        scope?.cancel()
        scope = null
        removeOverlay()
        return true
    }

    private fun observePlayback() {
        val activeScope = scope ?: return
        activeScope.launch {
            musicController.currentSong
                .distinctUntilChanged { old, new -> songKey(old) == songKey(new) }
                .collectLatest { song ->
                    latestSongKey = songKey(song)
                    latestLines = emptyList()
                    removeOverlay()
                    if (song != null) loadLyrics(song)
                }
        }
        activeScope.launch {
            combine(musicController.isPlaying, musicController.currentPosition) { isPlaying, position ->
                isPlaying to position
            }.collect { (isPlaying, position) ->
                latestPlaying = isPlaying
                latestPositionMs = position
                render()
            }
        }
    }

    private fun loadLyrics(song: SongInfo) {
        val activeScope = scope ?: return
        loadJob?.cancel()
        loadJob = activeScope.launch {
            val key = songKey(song)
            val content = withContext(Dispatchers.IO) { lyricRepository.loadLyrics(song) }
            if (key != latestSongKey) return@launch
            latestLines = if (content.hasLyrics) content.lines else emptyList()
            render()
        }
    }

    private fun render() {
        if (!Settings.canDrawOverlays(context)) {
            removeOverlay()
            return
        }

        val current = LyricParser.findCurrentLine(latestLines, latestPositionMs)
        val shouldShowLiveLyric = (config.enabled || settingsPreviewActive) &&
            latestPlaying &&
            current != null &&
            current.line.lineText.isNotBlank()

        if (shouldShowLiveLyric && current != null) {
            val view = ensureOverlayView()
            updateOverlayLayout()
            val useWordProgress =
                LyricDisplayPrefs.isUseWordLyricEnabled(context) && current.line.hasWordTiming
            view.bind(
                config = config,
                index = current.index,
                line = current.line,
                positionMs = latestPositionMs,
                useWordProgress = useWordProgress,
                lineProgress = current.progress,
                elapsedMs = current.elapsedMs,
                durationMs = current.durationMs,
            )
            return
        }

        if (settingsPreviewActive) {
            val view = ensureOverlayView()
            updateOverlayLayout()
            view.bindStaticPreview(config, PREVIEW_TEXT, PREVIEW_PROGRESS)
            return
        }

        if (current == null) {
            removeOverlay()
            return
        }
        removeOverlay()
    }

    private fun ensureOverlayView(): StatusBarLyricView {
        overlayView?.let { return it }
        val view = StatusBarLyricView(context).apply {
            setPadding(dp(4), 0, dp(4), 0)
        }
        windowManager.addView(view, buildLayoutParams())
        overlayView = view
        return view
    }

    private fun updateOverlayLayout() {
        val view = overlayView ?: return
        runCatching {
            windowManager.updateViewLayout(view, buildLayoutParams())
        }
    }

    private fun removeOverlay() {
        val view = overlayView ?: return
        overlayView = null
        runCatching { windowManager.removeView(view) }
    }

    private fun buildLayoutParams(): WindowManager.LayoutParams {
        val screenWidth = context.resources.displayMetrics.widthPixels
        val width = (screenWidth * config.widthPercent / 100f).roundToInt()
            .coerceIn(dp(120), screenWidth)
        val freeWidth = (screenWidth - width).coerceAtLeast(0)
        return WindowManager.LayoutParams(
            width,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = (freeWidth * config.xPercent / 100f).roundToInt()
            y = dp(config.yDp)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
    }

    private fun songKey(song: SongInfo?): String? = song?.let { "${it.type.name}:${it.id}" }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).roundToInt()

    private companion object {
        private const val PREVIEW_TEXT = "状态栏歌词预览"
        private const val PREVIEW_PROGRESS = 0.42f
    }
}
