package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.RenderEffect
import android.graphics.Shader
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.DisplayMetrics
import android.renderscript.Allocation
import android.renderscript.Element
import android.renderscript.RenderScript
import android.renderscript.ScriptIntrinsicBlur
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.coordinatorlayout.widget.CoordinatorLayout
import androidx.core.content.ContextCompat
import android.widget.SeekBar
import android.widget.TextView
import androidx.activity.addCallback
import androidx.annotation.OptIn
import androidx.core.graphics.drawable.toBitmap
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.LinearSmoothScroller
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityPlayerBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.player.LyricRow
import cn.partialy.pm.ui.player.LyricSettingsSheet
import cn.partialy.pm.ui.player.LyricsAdapter
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.AudioEmbeddedArtReader
import cn.partialy.pm.utils.SettingsPrefs
import coil.load
import coil.request.ImageRequest
import coil.ImageLoader
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.color.MaterialColors
import dagger.hilt.android.AndroidEntryPoint
import kotlin.math.abs
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey

@AndroidEntryPoint
class PlayerActivity : BaseDownloadActivity() {
    private lateinit var binding: ActivityPlayerBinding
    private lateinit var bottomSheetBehavior: BottomSheetBehavior<FrameLayout>
    private lateinit var lyricsAdapter: LyricsAdapter
    private var lyricRows: List<LyricRow> = emptyList()
    private var lyricCurrentIndex: Int = -1
    private var lastUserLyricScrollAtMs: Long = 0L
    private var lyricScrollState: Int = RecyclerView.SCROLL_STATE_IDLE
    private var lyricCenterSeekIndex: Int = -1
    /** 自动跟唱等代码触发的 [smoothScrollLyricsToCenter] 期间为 true，避免误显中线指示器。 */
    private var lyricsProgrammaticScrollInProgress: Boolean = false
    private val lyricSeekButtonHideRunnable = Runnable { updateLyricCenterSeekUi() }

    @OptIn(UnstableApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            binding = ActivityPlayerBinding.inflate(layoutInflater)
            setContentView(binding.root)
            enableEdgeToEdgeSystemBars(lightStatusBarIcons = false, lightNavigationBarIcons = false)
            applyInsets()

            setupBottomSheet()

            binding.playlistBottomSheet.playlistRecyclerView.apply {
                layoutManager = LinearLayoutManager(this@PlayerActivity)
                adapter = PlaylistAdapter(
                    songs = emptyList(),
                    currentPlayingId = musicController.currentSong.value?.id,
                    onItemClick = { song, _ ->
                        lifecycleScope.launch {
                            musicController.play(song)
                            bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
                        }
                    },
                    onRemoveClick = { song -> musicController.removeFromPlayList(song) },
                )
            }

            observePlaylist()

            setupPlaybackControls()
            setupLyricsList()
            observePlaybackState()

            onBackPressedDispatcher.addCallback(this) {
                if (bottomSheetBehavior.state != BottomSheetBehavior.STATE_HIDDEN) {
                    bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
                } else {
                    finish()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            finish()
        }
    }

    @OptIn(UnstableApi::class)
    private fun setupPlaybackControls() {
        binding.collapseButton.setOnClickListener { finish() }

        binding.moreButton.setOnClickListener { }

        binding.textDecreaseButton.setOnClickListener {
            lyricsAdapter.adjustTextSize(-1f, this)
        }

        binding.textIncreaseButton.setOnClickListener {
            lyricsAdapter.adjustTextSize(1f, this)
        }

        binding.lyricSettingsButton.setOnClickListener {
            LyricSettingsSheet.show(this) {
                lyricsAdapter.applyStyleFromPrefs(this@PlayerActivity)
            }
        }

        binding.progressBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    lifecycleScope.launch { musicController.seekToProgress(progress) }
                }
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        binding.playPauseButton.setOnClickListener {
            lifecycleScope.launch { musicController.togglePlayPause() }
        }

        binding.previousButton.setOnClickListener {
            lifecycleScope.launch { musicController.previous(auto = false) }
        }

        binding.nextButton.setOnClickListener {
            lifecycleScope.launch { musicController.next(auto = false) }
        }

        binding.loveButton.setOnClickListener {
            lifecycleScope.launch {
                musicController.currentSong.value?.let { song ->
                    loveManager.toggleLikeStatus(song)
                    binding.loveButton.setImageResource(
                        if (loveManager.isSongInLoveList(song)) R.drawable.ic_love_fill_24
                        else R.drawable.ic_love_24
                    )
                }
            }
        }

        binding.downloadButton.setOnClickListener {
            lifecycleScope.launch {
                musicController.currentSong.value?.let { song -> onDownloadClick(song) }
            }
        }

        binding.repeatButton.setOnClickListener {
            musicController.togglePlayMode()
            updatePlayModeIcon()
        }

        binding.playListButton.setOnClickListener {
            updatePlaylist(musicController.playList.value)
            bottomSheetBehavior.state = BottomSheetBehavior.STATE_EXPANDED
            scrollPlaylistToNowPlaying()
        }

        updatePlayModeIcon()
    }

    private fun updatePlayModeIcon() {
        val mode = musicController.getPlayMode()
        val icon = when (mode) {
            SettingsPrefs.PlayMode.Order -> R.drawable.ic_repeat_24
            SettingsPrefs.PlayMode.Shuffle -> R.drawable.ic_shuffle_24
            SettingsPrefs.PlayMode.Single -> R.drawable.ic_repeat_one_24
        }
        binding.repeatButton.setImageResource(icon)
        binding.repeatButton.alpha = 1.0f
    }

    private fun observePlaybackState() {
        lifecycleScope.launch {
            musicController.isPlaying.collect { isPlaying ->
                val icon = if (isPlaying) R.drawable.ic_pause_24 else R.drawable.ic_play_24
                binding.playPauseButton.setImageResource(icon)
            }
        }

        lifecycleScope.launch {
            musicController.currentSong.collect { song ->
                (binding.playlistBottomSheet.playlistRecyclerView.adapter as? PlaylistAdapter)
                    ?.setCurrentPlayingId(song?.id)
                song?.let {
                    binding.songTitleTextView.text = it.name
                    binding.artistTextView.text = it.artist
                    SongSourceTagBinder.bind(
                        binding.songSourceTagTextView,
                        it.type,
                        SongSourceTagBinder.Surface.ON_DARK,
                    )
                    binding.loveButton.setImageResource(
                        if (loveManager.isSongInLoveList(it)) R.drawable.ic_love_fill_24
                        else R.drawable.ic_love_24
                    )
                    applyLocalMediaFallbacks(it)
                    applyBlurBackground(modelForBlur(it))
                    if (it.type == SongType.LOCAL) {
                        submitLyricsText("正在获取歌词...")
                    }
                    submitLyricsText(setUpLyric(it))
                } ?: run {
                    SongSourceTagBinder.hide(binding.songSourceTagTextView)
                }
            }
        }

        lifecycleScope.launch {
            musicController.progress.collect { progress ->
                binding.progressBar.progress = progress.toInt()
            }
        }

        lifecycleScope.launch {
            musicController.currentPosition.collect { position ->
                binding.currentTimeTextView.text = formatTime(position.toInt())
                updateLyricTime(position)
            }
        }

        lifecycleScope.launch {
            musicController.duration.collect { duration ->
                binding.totalTimeTextView.text = formatTime(duration.toInt())
            }
        }
    }

    private fun setupLyricsList() {
        lyricsAdapter = LyricsAdapter()
        lyricsAdapter.applyStyleFromPrefs(this)
        binding.lyricCenterSeekOverlay.setOnClickListener {
            val idx = lyricCenterSeekIndex
            val rows = lyricRows
            if (idx < 0 || idx >= rows.size) return@setOnClickListener
            binding.lyricsRecyclerView.removeCallbacks(lyricSeekButtonHideRunnable)
            binding.lyricCenterSeekOverlay.visibility = View.GONE
            lastUserLyricScrollAtMs = SystemClock.elapsedRealtime()
            lifecycleScope.launch {
                musicController.seekToPositionMs(rows[idx].timeMs)
            }
        }
        binding.lyricsRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@PlayerActivity)
            adapter = lyricsAdapter
            itemAnimator = null
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrollStateChanged(recyclerView: RecyclerView, newState: Int) {
                    super.onScrollStateChanged(recyclerView, newState)
                    lyricScrollState = newState
                    if (newState == RecyclerView.SCROLL_STATE_DRAGGING) {
                        lastUserLyricScrollAtMs = SystemClock.elapsedRealtime()
                        lyricsProgrammaticScrollInProgress = false
                    }
                    if (newState == RecyclerView.SCROLL_STATE_IDLE) {
                        lyricsProgrammaticScrollInProgress = false
                    }
                    updateLyricCenterSeekUi()
                }

                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    if (lyricsProgrammaticScrollInProgress) return
                    updateLyricCenterSeekUi()
                }
            })
            addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
                applyLyricsRecyclerVerticalPadding()
            }
        }
    }

    /** 与 [smoothScrollLyricsToCenter] 使用同一竖直中线，取距中线最近的一行。 */
    private fun findLyricIndexAtCenter(): Int {
        val rv = binding.lyricsRecyclerView
        val lm = rv.layoutManager as? LinearLayoutManager ?: return -1
        if (rv.height <= 0) return -1
        val parentCenter =
            rv.paddingTop + (rv.height - rv.paddingTop - rv.paddingBottom) / 2
        var bestPos = -1
        var bestDist = Int.MAX_VALUE
        val first = lm.findFirstVisibleItemPosition()
        val last = lm.findLastVisibleItemPosition()
        if (first == RecyclerView.NO_POSITION || last == RecyclerView.NO_POSITION) return -1
        for (i in first..last) {
            val child = lm.findViewByPosition(i) ?: continue
            val childCenter = (child.top + child.bottom) / 2
            val dist = abs(childCenter - parentCenter)
            if (dist < bestDist) {
                bestDist = dist
                bestPos = i
            }
        }
        return bestPos
    }

    private fun updateLyricCenterSeekUi() {
        val rv = binding.lyricsRecyclerView
        rv.removeCallbacks(lyricSeekButtonHideRunnable)
        val overlay = binding.lyricCenterSeekOverlay
        if (lyricsProgrammaticScrollInProgress) {
            overlay.visibility = View.GONE
            return
        }
        lyricCenterSeekIndex = findLyricIndexAtCenter()
        val rows = lyricRows
        if (rows.isEmpty()) {
            overlay.visibility = View.GONE
            return
        }
        val since = SystemClock.elapsedRealtime() - lastUserLyricScrollAtMs
        val inBrowseWindow = since < 3_000
        // 仅用户拖动/惯性滚动后的浏览窗口内显示；自动跟唱滚动由 lyricsProgrammaticScrollInProgress 屏蔽
        val show =
            lyricScrollState == RecyclerView.SCROLL_STATE_DRAGGING ||
                lyricScrollState == RecyclerView.SCROLL_STATE_SETTLING ||
                (lyricScrollState == RecyclerView.SCROLL_STATE_IDLE && inBrowseWindow)
        val visible = show && lyricCenterSeekIndex >= 0
        overlay.visibility = if (visible) View.VISIBLE else View.GONE
        if (visible && lyricCenterSeekIndex < rows.size) {
            binding.lyricCenterSeekTimeText.text =
                formatTime(rows[lyricCenterSeekIndex].timeMs.toInt())
        }
        if (show && lyricScrollState == RecyclerView.SCROLL_STATE_IDLE && inBrowseWindow) {
            val delay = (3_000 - since).coerceAtLeast(0L)
            rv.postDelayed(lyricSeekButtonHideRunnable, delay)
        }
    }

    /** 上下各约为列表可视高度一半，首尾句可滚到与当前高亮相同的竖直中线位置。 */
    private fun applyLyricsRecyclerVerticalPadding() {
        val rv = binding.lyricsRecyclerView
        val h = rv.height
        if (h <= 0) return
        val pad = h / 2
        if (rv.paddingTop == pad && rv.paddingBottom == pad) return
        rv.updatePadding(top = pad, bottom = pad)
        if (lyricCurrentIndex >= 0) {
            rv.post {
                smoothScrollLyricsToCenter(lyricCurrentIndex)
                updateLyricCenterSeekUi()
            }
        }
    }

    private fun submitLyricsText(text: String) {
        lyricRows = parseLyricRows(text)
        lyricCurrentIndex = if (lyricRows.isEmpty()) -1 else 0
        lyricsAdapter.submitList(lyricRows) {
            lyricsAdapter.setCurrentIndex(lyricCurrentIndex)
            if (lyricCurrentIndex >= 0) {
                binding.lyricsRecyclerView.post { smoothScrollLyricsToCenter(lyricCurrentIndex) }
            }
            binding.lyricsRecyclerView.post { updateLyricCenterSeekUi() }
        }
    }

    private fun updateLyricTime(currentTime: Long) {
        val rows = lyricRows
        if (rows.isEmpty()) return
        var idx = 0
        for (i in rows.indices) {
            if (i == rows.lastIndex || currentTime < rows[i + 1].timeMs) {
                idx = i
                break
            }
        }
        if (idx == lyricCurrentIndex) return
        lyricCurrentIndex = idx
        lyricsAdapter.setCurrentIndex(idx)
        val sinceUser = SystemClock.elapsedRealtime() - lastUserLyricScrollAtMs
        if (sinceUser >= 3_000) {
            smoothScrollLyricsToCenter(idx)
        }
    }

    private fun smoothScrollLyricsToCenter(position: Int) {
        val lm = binding.lyricsRecyclerView.layoutManager as? LinearLayoutManager ?: return
        if (binding.lyricsRecyclerView.height <= 0) return
        val scroller = object : LinearSmoothScroller(this) {
            override fun getVerticalSnapPreference(): Int = SNAP_TO_ANY

            /** 默认约 25ms/inch，短距离跟唱常在百毫秒内结束，观感像「闪一下」。略放慢并加最短滚动时长。 */
            override fun calculateSpeedPerPixel(displayMetrics: DisplayMetrics): Float =
                40f / displayMetrics.densityDpi

            override fun calculateTimeForScrolling(dx: Int): Int =
                super.calculateTimeForScrolling(dx).coerceAtLeast(240)

            override fun calculateDyToMakeVisible(view: View, snapPreference: Int): Int {
                val parentCenter =
                    (binding.lyricsRecyclerView.paddingTop +
                        (binding.lyricsRecyclerView.height - binding.lyricsRecyclerView.paddingTop - binding.lyricsRecyclerView.paddingBottom) / 2)
                val childCenter = (view.top + view.bottom) / 2
                // dy>0 表示内容上移（向下滚动），dy<0 表示内容下移（向上滚动）
                return parentCenter - childCenter
            }
        }
        scroller.targetPosition = position
        lyricsProgrammaticScrollInProgress = true
        lm.startSmoothScroll(scroller)
    }

    private fun parseLyricRows(lyricsText: String): List<LyricRow> {
        val timePattern = "\\[(\\d{2}):(\\d{2})\\.(\\d{2,3})]".toRegex()
        val out = mutableListOf<LyricRow>()
        lyricsText.split("\n").forEach { line ->
            val m = timePattern.find(line) ?: return@forEach
            val g = m.groupValues
            val minutes = g[1].toIntOrNull() ?: return@forEach
            val seconds = g[2].toIntOrNull() ?: return@forEach
            val ms = g[3].toIntOrNull() ?: 0
            val t = (minutes * 60 * 1000 + seconds * 1000 + ms).toLong()
            val text = line.substring(m.range.last + 1).trim()
            if (text.isNotEmpty()) out.add(LyricRow(t, text))
        }
        if (out.isNotEmpty()) return out.sortedBy { it.timeMs }
        val fallback = lyricsText.trim()
        return if (fallback.isEmpty()) emptyList() else listOf(LyricRow(0L, fallback))
    }

    private fun modelForBlur(song: SongInfo): Any? {
        return song.embeddedCoverArt ?: song.coverUrl.takeIf { it.isNotBlank() }
    }

    private suspend fun applyLocalMediaFallbacks(song: SongInfo) {
        if (song.type != SongType.LOCAL) return
        if (song.embeddedCoverArt == null) {
            val bytes = withContext(Dispatchers.IO) {
                AudioEmbeddedArtReader.readEmbeddedCoverBytes(this@PlayerActivity, File(song.id))
            }
            if (bytes != null && bytes.isNotEmpty()) song.embeddedCoverArt = bytes
        }
    }

    private fun applyBlurBackground(model: Any?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            binding.blurredBgImageView.load(model) {
                crossfade(true)
                placeholder(R.drawable.ic_pisa_piece_24)
                error(R.drawable.ic_pisa_piece_24)
            }
            binding.blurredBgImageView.setRenderEffect(
                RenderEffect.createBlurEffect(400f, 400f, Shader.TileMode.CLAMP)
            )
        } else {
            val request = ImageRequest.Builder(this)
                .data(model)
                .target { drawable ->
                    val bitmap = drawable.toBitmap()
                    val blurred = blurBitmapWithRenderScript(bitmap, 25f)
                    binding.blurredBgImageView.setImageBitmap(blurred)
                }
                .build()
            ImageLoader(this).enqueue(request)
        }
    }

    @Suppress("DEPRECATION")
    private fun blurBitmapWithRenderScript(source: Bitmap, radius: Float): Bitmap {
        val scaledWidth = (source.width / 8).coerceAtLeast(1)
        val scaledHeight = (source.height / 8).coerceAtLeast(1)
        val input = Bitmap.createScaledBitmap(source, scaledWidth, scaledHeight, true)
        val output = Bitmap.createBitmap(input.width, input.height, Bitmap.Config.ARGB_8888)

        val rs = RenderScript.create(this)
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

    private fun formatTime(milliseconds: Int): String {
        val seconds = milliseconds / 1000
        val minutes = seconds / 60
        val remainingSeconds = seconds % 60
        return String.format("%02d:%02d", minutes, remainingSeconds)
    }

    private suspend fun setUpLyric(song: SongInfo): String {
        if (song.type == SongType.LOCAL) {
            // 1) 尝试读取内嵌歌词字段
            val embedded = withContext(Dispatchers.IO) {
                try {
                    val audio = AudioFileIO.read(File(song.id))
                    audio.tag?.getFirst(FieldKey.LYRICS).orEmpty().trim()
                } catch (_: Exception) {
                    ""
                }
            }
            if (embedded.isNotEmpty()) return embedded
            // 2) 尝试读取同目录 .lrc
            val siblingLrc = withContext(Dispatchers.IO) {
                try {
                    val f = File(song.id)
                    val lrc = File(f.parentFile, "${f.nameWithoutExtension}.lrc")
                    if (lrc.exists()) lrc.readText() else ""
                } catch (_: Exception) {
                    ""
                }
            }
            if (siblingLrc.isNotBlank()) return siblingLrc

            // 3) 读取 app 缓存（local_<文件名含扩展名>）
            val cached = withContext(Dispatchers.IO) {
                try {
                    val f = File(song.id)
                    val key = "local_${f.name}"
                    val cacheFile = File(cacheDir, key)
                    if (cacheFile.exists()) cacheFile.readText() else ""
                } catch (_: Exception) {
                    ""
                }
            }
            if (cached.isNotBlank()) return cached

            // 4) 终极兜底：按文件名组 keywords 走 KG 搜索歌词（仍按 accesskey 流程取内容）
            val fetched = try {
                val f = File(song.id)
                val keywords = buildLocalLyricKeywords(f)
                kgRepository.getLyricByKeywords(keywords).getOrNull().orEmpty()
            } catch (_: Exception) {
                ""
            }.trim()

            if (fetched.isNotEmpty()) {
                withContext(Dispatchers.IO) {
                    try {
                        val f = File(song.id)
                        val key = "local_${f.name}"
                        File(cacheDir, key).writeText(fetched)
                    } catch (_: Exception) {
                    }
                }
                return fetched
            }

            return "暂无歌词"
        }
        val localFile = File(cacheDir, "${song.type.name}_${song.id}")
        if (localFile.exists()) {
            return localFile.readText()
        }
        return try {
            when (song.type) {
                SongType.KG -> {
                    val res = kgRepository.getLyric(song.id)
                    res.fold(
                        onSuccess = { lyric ->
                            localFile.writeText(lyric)
                            lyric
                        },
                        onFailure = { "error" },
                    )
                }
                SongType.WY -> {
                    val id = song.id.toLongOrNull() ?: return "error"
                    wyRepository.getLyric(id).fold(
                        onSuccess = { lyric ->
                            if (lyric.isNotEmpty()) localFile.writeText(lyric)
                            lyric
                        },
                        onFailure = { "error" },
                    )
                }
                SongType.KW, SongType.LOCAL -> ""
            }
        } catch (e: Exception) {
            "error"
        }
    }

    private fun buildLocalLyricKeywords(file: File): String {
        val raw = file.nameWithoutExtension.trim()
        if (raw.isEmpty()) return ""
        val sep = " - "
        val idx = raw.indexOf(sep)
        if (idx > 0) {
            val artist = raw.substring(0, idx).trim()
            val title = raw.substring(idx + sep.length).trim()
            val joined = listOf(artist, title).filter { it.isNotEmpty() }.joinToString(" ")
            return joined.ifBlank { raw }
        }
        return raw
    }

    private fun observePlaylist() {
        lifecycleScope.launch {
            musicController.playList.collect { songs ->
                updatePlaylist(songs)
            }
        }
    }

    private fun updatePlaylist(songs: List<SongInfo>) {
        val adapter = binding.playlistBottomSheet.playlistRecyclerView.adapter as? PlaylistAdapter ?: return
        adapter.updateSongs(songs)
        if (songs.isEmpty()) {
            binding.playlistBottomSheet.playlistEmptyText.visibility = View.VISIBLE
            binding.playlistBottomSheet.playlistRecyclerView.visibility = View.GONE
        } else {
            binding.playlistBottomSheet.playlistEmptyText.visibility = View.GONE
            binding.playlistBottomSheet.playlistRecyclerView.visibility = View.VISIBLE
        }
    }

    private fun scrollPlaylistToNowPlaying() {
        val rv = binding.playlistBottomSheet.playlistRecyclerView
        val songs = musicController.playList.value
        if (songs.isEmpty()) return
        val currentId = musicController.currentSong.value?.id ?: return
        val idx = songs.indexOfFirst { it.id == currentId }
        if (idx < 0) return

        rv.post {
            (rv.layoutManager as? LinearLayoutManager)
                ?.scrollToPositionWithOffset(idx, rv.height / 3)
                ?: rv.scrollToPosition(idx)
        }
    }

    @SuppressLint("SetTextI18n")
    private fun setupBottomSheet() {
        val bottomSheet = binding.standardBottomSheet
        val screenHeight = resources.displayMetrics.heightPixels
        val sheetHeight = (screenHeight * 0.7f).toInt()
        (bottomSheet.layoutParams as CoordinatorLayout.LayoutParams).height = sheetHeight

        bottomSheetBehavior = BottomSheetBehavior.from(bottomSheet)
        bottomSheetBehavior.maxHeight = sheetHeight
        bottomSheetBehavior.apply {
            isFitToContents = true
            isHideable = true
            state = BottomSheetBehavior.STATE_HIDDEN
            peekHeight = (screenHeight * 0.4).toInt()
        }

        val title = findViewById<TextView>(R.id.playingQueueTitle)
        title?.apply {
            text = "播放队列(${musicController.playList.value.size}首)"
        }

        binding.playlistBottomSheet.clearPlayList.setOnClickListener {
            musicController.clearPlayList()
            bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
        }

        binding.dimOverlay.setOnClickListener {
            bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
        }

        binding.playlistBottomSheet.root.setOnClickListener { }

        bottomSheetBehavior.addBottomSheetCallback(object : BottomSheetBehavior.BottomSheetCallback() {
            override fun onStateChanged(bottomSheet: View, newState: Int) {
                when (newState) {
                    BottomSheetBehavior.STATE_HIDDEN -> {
                        binding.dimOverlay.animate()
                            .alpha(0f)
                            .setDuration(200)
                            .withEndAction { binding.dimOverlay.visibility = View.GONE }
                    }
                    else -> {
                        if (binding.dimOverlay.visibility == View.GONE) {
                            binding.dimOverlay.alpha = 0f
                            binding.dimOverlay.visibility = View.VISIBLE
                            binding.dimOverlay.animate().alpha(1f).setDuration(200)
                        }
                    }
                }
            }

            override fun onSlide(bottomSheet: View, slideOffset: Float) {
                if (slideOffset >= 0) {
                    binding.dimOverlay.visibility = View.VISIBLE
                    binding.dimOverlay.alpha = slideOffset
                } else {
                    binding.dimOverlay.visibility = View.GONE
                }
            }
        })
    }

    private fun applyInsets() {
        binding.playerRoot.applySystemBarsInsets { insets ->
            binding.headerBar.updatePadding(top = insets.top)
            binding.controlsLayout.updatePadding(bottom = insets.bottom + (resources.displayMetrics.density * 8).toInt())
            binding.standardBottomSheet.updatePadding(bottom = insets.bottom)
        }
    }

    override fun finish() {
        super.finish()
        overridePendingTransition(R.anim.dim_and_scale_in, R.anim.slide_down)
    }

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, PlayerActivity::class.java)
            context.startActivity(intent)
            (context as Activity).overridePendingTransition(R.anim.slide_up, R.anim.dim_and_scale_out)
        }
    }
}

class PlaylistAdapter(
    private var songs: List<SongInfo>,
    private var currentPlayingId: String?,
    private val onItemClick: (SongInfo, Int) -> Unit,
    private val onRemoveClick: (SongInfo) -> Unit,
) : RecyclerView.Adapter<PlaylistAdapter.ViewHolder>() {

    fun updateSongs(newSongs: List<SongInfo>) {
        val diff = DiffUtil.calculateDiff(SongDiffCallback(songs, newSongs))
        songs = newSongs
        diff.dispatchUpdatesTo(this)
    }

    fun setCurrentPlayingId(id: String?) {
        if (currentPlayingId == id) return
        val oldIdx = songs.indexOfFirst { it.id == currentPlayingId }
        val newIdx = songs.indexOfFirst { it.id == id }
        currentPlayingId = id
        if (oldIdx >= 0) notifyItemChanged(oldIdx)
        if (newIdx >= 0) notifyItemChanged(newIdx)
    }

    private class SongDiffCallback(
        private val old: List<SongInfo>,
        private val new: List<SongInfo>,
    ) : DiffUtil.Callback() {
        override fun getOldListSize() = old.size
        override fun getNewListSize() = new.size
        override fun areItemsTheSame(o: Int, n: Int) =
            old[o].type == new[n].type && old[o].id == new[n].id
        override fun areContentsTheSame(o: Int, n: Int) =
            old[o].name == new[n].name && old[o].artist == new[n].artist
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_playlist_song, parent, false)
        return ViewHolder(view, onRemoveClick)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val song = songs[position]
        val isCurrent = song.id == currentPlayingId
        holder.bind(song, isCurrent)
        holder.itemView.setOnClickListener {
            val pos = holder.bindingAdapterPosition
            if (pos != RecyclerView.NO_POSITION) onItemClick(song, pos)
        }
    }

    override fun getItemCount() = songs.size

    class ViewHolder(
        view: View,
        private val onRemoveClick: (SongInfo) -> Unit,
    ) : RecyclerView.ViewHolder(view) {
        private val lineText: TextView = view.findViewById(R.id.songLineText)
        private val tagView: TextView = view.findViewById(R.id.songSourceTagTextView)
        private val removeButton: View = view.findViewById(R.id.removeFromPlayList)

        fun bind(song: SongInfo, isCurrent: Boolean) {
            val ctx = itemView.context
            val separator = " - "
            removeButton.setOnClickListener { onRemoveClick(song) }
            SongSourceTagBinder.bind(tagView, song.type)

            if (isCurrent) {
                itemView.setBackgroundColor(
                    ContextCompat.getColor(ctx, R.color.playlist_now_playing_row_bg),
                )
                lineText.text = buildString {
                    append(song.name)
                    append(separator)
                    append(song.artist)
                }
                lineText.setTextColor(ContextCompat.getColor(ctx, R.color.playlist_playing_text))
            } else {
                itemView.setBackgroundColor(Color.TRANSPARENT)
                val onSurface = MaterialColors.getColor(
                    itemView,
                    com.google.android.material.R.attr.colorOnSurface,
                    Color.BLACK,
                )
                val artistColor = ContextCompat.getColor(ctx, R.color.playlist_item_artist)
                val ssb = SpannableStringBuilder().apply {
                    append(song.name)
                    setSpan(
                        ForegroundColorSpan(onSurface),
                        0,
                        song.name.length,
                        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                    )
                    append(separator)
                    append(song.artist)
                    setSpan(
                        ForegroundColorSpan(artistColor),
                        song.name.length,
                        length,
                        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                    )
                }
                lineText.text = ssb
            }
        }
    }
}
