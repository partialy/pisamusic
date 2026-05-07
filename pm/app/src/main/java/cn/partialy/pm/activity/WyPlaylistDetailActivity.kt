package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.annotation.OptIn
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.core.widget.ImageViewCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.network.cookie.model.toSongInfoOrNull
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.mine.MinePlaylistMoreBottomSheet
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import kotlin.math.max
import kotlin.math.min

/**
 * 网易云歌单详情：布局与交互同 [PlaylistDetailActivity]，曲目来自网关
 * [WyCookieRepository.getPlaylistTrackAll]（`/playlist/track/all`）。
 */
@AndroidEntryPoint
class WyPlaylistDetailActivity : BaseDownloadActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    @Inject
    lateinit var wyCookieRepository: WyCookieRepository

    private lateinit var binding: ActivityPlaylistDetailBinding
    private var miniPlayerBinder: HomeMiniPlayerBinder? = null

    private var pagingPlaylistId: String = ""
    /** 收藏列表带来的曲目数提示，用于「共 n 首」 */
    private var playlistTrackTotalHint: Int = 0
    private lateinit var storageType: CollectedPlaylistType
    /** 后台全量加载协程 */
    private var allTracksLoadJob: Job? = null

    private var toolbarScrollOffsetStablePx: Int = 0
    private var stickyPlayAllShown: Boolean = false
    private var lastHeaderIconTint: Int = android.graphics.Color.WHITE
    private var isDarkMode: Boolean = false
    private lateinit var insetsController: WindowInsetsControllerCompat

    private val listAdapter = PlaylistDetailListAdapter(
        onItemClick = { song, pos -> playPlaylistFromSong(song, pos) },
        isSongLiked = { loveManager.isSongInLoveList(it) },
        onLoveClick = { song, pos ->
            loveManager.toggleLikeStatus(song)
            binding.recyclerView.post {
                binding.recyclerView.adapter?.notifyItemChanged(pos)
            }
        },
        onDownloadClick = { song, _ -> onDownloadClick(song) },
        onMoreClick = { song, _ -> openSongMoreMenu(song) },
    )

    @OptIn(UnstableApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityPlaylistDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        if (!parseIntentArgs()) return

        setupSystemBars()
        setupHeaderBar()
        setupListView()
        setupPlayAllButtons()
        setupScrollBehavior()
        setupMiniPlayer()
        observeCollectionState()

        lifecycleScope.launch { loadPlaylistInitial(pagingPlaylistId) }
    }

    /** 解析 Intent 参数，无效时关闭页面并返回 false */
    private fun parseIntentArgs(): Boolean {
        pagingPlaylistId = intent.getStringExtra(EXTRA_PLAYLIST_ID).orEmpty()
        if (pagingPlaylistId.isBlank()) {
            finish()
            return false
        }
        storageType = parseStorageType(intent.getStringExtra(EXTRA_STORAGE_TYPE))
        playlistTrackTotalHint = intent.getIntExtra(EXTRA_TRACK_COUNT, 0).coerceAtLeast(0)
        return true
    }

    /** 全屏沉浸、Insets、返回键 */
    private fun setupSystemBars() {
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = false, lightNavigationBarIcons = true)
        applyPlaylistDetailInsets()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = finishAnimated()
        })
    }

    /** 顶栏高度适配 StatusBar、按钮点击 */
    private fun setupHeaderBar() {
        isDarkMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        insetsController = WindowInsetsControllerCompat(window, binding.root)
        val baseHeaderHeightPx = (56f * resources.displayMetrics.density).toInt().coerceAtLeast(1)

        ViewCompat.setOnApplyWindowInsetsListener(binding.headerBar) { v, insets ->
            val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            v.layoutParams = v.layoutParams.apply { height = baseHeaderHeightPx + top }
            binding.headerBarContent.updatePadding(top = top)
            insets
        }

        binding.backButton.setOnClickListener { finishAnimated() }
        binding.playlistCollectButton.setOnClickListener { togglePlaylistCollect() }
        binding.moreButton.setOnClickListener {
            val pl = playlistCollectionManager.findWyLikeCollected(pagingPlaylistId)
            if (pl == null) {
                Toast.makeText(this, R.string.mine_playlist_delete_not_collected, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            MinePlaylistMoreBottomSheet.show(this, pl, playlistCollectionManager) { finishAnimated() }
        }

        binding.headerBg.alpha = 0f
        applyStatusBarIconStyle(0f)
        lastHeaderIconTint = ContextCompat.getColor(this, android.R.color.white)
        binding.backButton.setColorFilter(lastHeaderIconTint)
        applyPlaylistCollectButtonTint()
        binding.moreButton.setColorFilter(lastHeaderIconTint)
        binding.playlistTitleHeaderTextView.isVisible = false
    }

    /** RecyclerView + Adapter + 用 Intent 数据填充初始 Header */
    private fun setupListView() {
        listAdapter.onHeaderUpdated = {
            syncStickyPlayAllTrackCount()
            syncHeaderBarPlaylistTitle()
        }

        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@WyPlaylistDetailActivity)
            adapter = listAdapter
            itemAnimator = null
        }

        listAdapter.updateHeader(
            title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "歌单" },
            desc = intent.getStringExtra(EXTRA_PLAY_COUNT_LABEL).orEmpty().ifBlank { "歌单描述" },
            coverUrl = intent.getStringExtra(EXTRA_COVER_URL).orEmpty(),
            trackCountText = if (playlistTrackTotalHint > 0) "${playlistTrackTotalHint}首" else "",
        )
        listAdapter.showInitialLoading()
    }

    /** "播放全部"按钮（Header 内嵌 + 吸顶栏） */
    private fun setupPlayAllButtons() {
        val playAll: () -> Unit = {
            val list = listAdapter.currentSongs
            if (list.isNotEmpty()) {
                musicController.setPlayListLazy(list, startIndex = 0, sourceId = pagingPlaylistId)
                ensurePlaylistEnriched()
            }
        }
        listAdapter.onPlayAllClick = playAll
        ImageViewCompat.setImageTintList(
            binding.stickyPlayAllBar.btnPlayAllSticky,
            ColorStateList.valueOf(ContextCompat.getColor(this, R.color.primary)),
        )
        binding.stickyPlayAllBar.btnPlayAllSticky.setOnClickListener { playAll() }
        binding.stickyPlayAllBar.stickyPlayAllRow.setOnClickListener { playAll() }
        syncStickyPlayAllTrackCount()
        syncHeaderBarPlaylistTitle()

        binding.playlistCollectButton.isVisible = true
        syncPlaylistCollectButton()
    }

    /** 滚动监听：顶栏透明度渐变 + 吸顶"播放全部"栏 */
    private fun setupScrollBehavior() {
        val triggerPx = (180f * resources.displayMetrics.density).toInt().coerceAtLeast(1)
        binding.recyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                val lm = recyclerView.layoutManager as? LinearLayoutManager ?: return
                val v0 = lm.findViewByPosition(0)
                val raw = if (v0 != null) {
                    (recyclerView.paddingTop - lm.getDecoratedTop(v0)).coerceAtLeast(0)
                } else {
                    recyclerView.computeVerticalScrollOffset().coerceAtLeast(0)
                }
                toolbarScrollOffsetStablePx = mergeToolbarScrollStable(
                    prev = toolbarScrollOffsetStablePx, raw = raw, dy = dy,
                )
                val alpha = (toolbarScrollOffsetStablePx.toFloat() / triggerPx).coerceIn(0f, 1f)
                val barOpaque = alpha >= 1f
                binding.headerBg.alpha = alpha
                applyStatusBarIconStyle(alpha)

                val iconTint = if (alpha < 0.5f) android.R.color.white else R.color.home_tab_unselected
                val color = ContextCompat.getColor(this@WyPlaylistDetailActivity, iconTint)
                lastHeaderIconTint = color
                binding.backButton.setColorFilter(color)
                applyPlaylistCollectButtonTint()
                binding.moreButton.setColorFilter(color)
                binding.playlistTitleHeaderTextView.isVisible = barOpaque
                applyStickyPlayAllVisibility(barOpaque)
            }
        })
    }

    /** 底部迷你播放条 */
    private fun setupMiniPlayer() {
        miniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@WyPlaylistDetailActivity)
        }
    }

    /** 收藏状态变化监听 */
    private fun observeCollectionState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                playlistCollectionManager.playlistsFlow.collect { syncPlaylistCollectButton() }
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                loveManager.loveListFlow.collect {
                    listAdapter.notifyDataSetChanged()
                }
            }
        }
    }

    /** 根据滚动偏移设置状态栏图标颜色 */
    private fun applyStatusBarIconStyle(headerAlpha: Float) {
        if (isDarkMode) {
            insetsController.isAppearanceLightStatusBars = false
            return
        }
        insetsController.isAppearanceLightStatusBars = headerAlpha >= 0.5f
    }

    private fun parseStorageType(name: String?): CollectedPlaylistType {
        val t = runCatching { CollectedPlaylistType.valueOf(name.orEmpty()) }.getOrNull()
        return when (t) {
            CollectedPlaylistType.WY, CollectedPlaylistType.IMPORT_WY -> t
            else -> CollectedPlaylistType.WY
        }
    }

    private fun isWyPlaylistCollected(): Boolean =
        playlistCollectionManager.isCollected(CollectedPlaylistType.WY, pagingPlaylistId) ||
            playlistCollectionManager.isCollected(CollectedPlaylistType.IMPORT_WY, pagingPlaylistId)

    private fun applyPlaylistCollectButtonTint() {
        if (!binding.playlistCollectButton.isVisible) return
        val collected = isWyPlaylistCollected()
        val tint = if (collected) {
            ContextCompat.getColor(this, R.color.red)
        } else {
            lastHeaderIconTint
        }
        binding.playlistCollectButton.setColorFilter(tint)
    }

    private fun syncPlaylistCollectButton() {
        val collected = isWyPlaylistCollected()
        binding.playlistCollectButton.setImageResource(
            if (collected) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
        )
        applyPlaylistCollectButtonTint()
    }

    private fun buildWyCollectedPlaylistForStorage(): CollectedPlaylist {
        val count = when {
            playlistTrackTotalHint > 0 -> playlistTrackTotalHint
            else -> listAdapter.currentSongs.size
        }
        return CollectedPlaylist(
            type = storageType,
            id = pagingPlaylistId,
            name = listAdapter.headerTitleText,
            intro = listAdapter.headerDescText,
            cover = listAdapter.headerCoverUrl,
            count = count.coerceAtLeast(0),
        )
    }

    private fun togglePlaylistCollect() {
        if (pagingPlaylistId.isBlank()) return
        val existing = playlistCollectionManager.findWyLikeCollected(pagingPlaylistId)
        if (existing != null) {
            playlistCollectionManager.removePlaylist(existing.type, existing.id)
        } else {
            playlistCollectionManager.addNetworkPlaylist(buildWyCollectedPlaylistForStorage())
        }
        syncPlaylistCollectButton()
    }

    private fun syncStickyPlayAllTrackCount() {
        binding.stickyPlayAllBar.trackCountTextViewSticky.text = listAdapter.headerTrackCountText
    }

    private fun syncHeaderBarPlaylistTitle() {
        binding.playlistTitleHeaderTextView.text = listAdapter.headerTitleText
    }

    private fun mergeToolbarScrollStable(prev: Int, raw: Int, dy: Int): Int {
        val d = resources.displayMetrics.density
        val slack = (28f * d).toInt().coerceAtLeast(20)
        val layoutSlack = (72f * d).toInt().coerceAtLeast(56)
        return when {
            dy < 0 -> {
                val drop = prev - raw
                if (raw < prev && drop > (-dy) + slack && (-dy) * 2 < drop) {
                    prev
                } else {
                    min(prev, raw)
                }
            }
            dy > 0 -> {
                val rise = raw - prev
                if (raw > prev && rise > dy + slack && dy * 2 < rise) {
                    prev
                } else {
                    max(prev, raw)
                }
            }
            else -> {
                when {
                    raw < prev - layoutSlack -> prev
                    raw > prev + layoutSlack -> raw
                    else -> raw
                }
            }
        }.coerceAtLeast(0)
    }

    private fun applyStickyPlayAllVisibility(show: Boolean) {
        binding.stickyPlayAllBar.root.isVisible = show
        if (stickyPlayAllShown == show) return
        stickyPlayAllShown = show
        listAdapter.hideInlinePlayAllWhenSticky = show
        if (listAdapter.itemCount > 0) {
            val rv = binding.recyclerView
            rv.post {
                if (listAdapter.itemCount > 0) {
                    listAdapter.notifyItemChanged(0)
                }
            }
        }
    }

    private fun applyPlaylistDetailInsets() {
        val miniBottomBase = resources.getDimensionPixelSize(R.dimen.home_mini_player_bottom_margin)
        val overlapPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_overlap)
        val miniHeightPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_height)
        binding.root.applySystemBarsInsets { insets ->
            val lp = binding.homeMiniPlayer.root.layoutParams as ConstraintLayout.LayoutParams
            lp.bottomMargin = miniBottomBase + overlapPx + insets.bottom
            binding.homeMiniPlayer.root.layoutParams = lp

            val listPadBottom = miniHeightPx + miniBottomBase + insets.bottom
            binding.recyclerView.updatePadding(bottom = listPadBottom)
        }
    }

    private fun finishAnimated() {
        finish()
        overridePendingTransition(R.anim.playlist_previous_scale_from_95, R.anim.slide_to_right)
    }

    override fun onDestroy() {
        allTracksLoadJob?.cancel()
        allTracksLoadJob = null
        miniPlayerBinder?.onDestroy()
        miniPlayerBinder = null
        super.onDestroy()
    }

    private fun openSongMoreMenu(song: SongInfo) {
        SongMoreMenu.show(
            this,
            song,
            SongMoreMenuDependencies(
                musicController = musicController,
                loveManager = loveManager,
                playlistCollectionManager = playlistCollectionManager,
                onDownloadClick = { startSongDownloadFlow(it) },
            ),
        )
    }

    private fun playPlaylistFromSong(song: SongInfo, adapterPosition: Int) {
        if (adapterPosition <= 0) return
        val songs = listAdapter.currentSongs
        val idx = songs.indexOfFirst { it.id == song.id && it.type == song.type }
        if (idx < 0) return
        musicController.setPlayListLazy(songs, startIndex = idx, sourceId = pagingPlaylistId)
        ensurePlaylistEnriched()
    }

    /** 如果播放队列比 adapter 少（后台还没加载完时点击），把差量补上 */
    private fun ensurePlaylistEnriched() {
        val adapterSongs = listAdapter.currentSongs
        val queueSize = musicController.playList.value.size
        if (queueSize >= adapterSongs.size) return
        musicController.appendSongsLazy(adapterSongs.subList(queueSize, adapterSongs.size))
    }

    private suspend fun loadPlaylistInitial(playlistId: String) {
        val first = withContext(Dispatchers.IO) {
            wyCookieRepository.getPlaylistTrackAll(
                id = playlistId,
                limit = FIRST_PAGE_SIZE,
                offset = 0,
            ).getOrNull()
        }
        withContext(Dispatchers.Main) {
            if (first == null || (first.code != null && first.code != 200)) {
                listAdapter.setFirstPageFailed()
                return@withContext
            }
            val mapped = first.songs.orEmpty().mapNotNull { it.toSongInfoOrNull() }
            val apiTotal = playlistTrackTotalHint
            val label = when {
                apiTotal > 0 -> "${apiTotal}首"
                mapped.isNotEmpty() -> "${mapped.size}首"
                else -> ""
            }
            listAdapter.updateHeader(trackCountText = label)
            listAdapter.setFirstPageSuccess(
                rows = mapped,
                apiTotal = apiTotal,
                apiPage = 1,
                apiPageSize = FIRST_PAGE_SIZE,
            )
            syncPlaylistCollectButton()
            if (apiTotal > mapped.size) {
                loadAllRemainingTracks(playlistId, mapped.size, apiTotal)
            }
        }
    }

    /** 一次性加载歌单全部剩余歌曲（offset-based） */
    private fun loadAllRemainingTracks(playlistId: String, loadedCount: Int, totalCount: Int) {
        allTracksLoadJob?.cancel()
        allTracksLoadJob = lifecycleScope.launch {
            val resp = withContext(Dispatchers.IO) {
                wyCookieRepository.getPlaylistTrackAll(
                    id = playlistId,
                    limit = totalCount - loadedCount,
                    offset = loadedCount,
                ).getOrNull()
            } ?: return@launch
            if (resp.code != null && resp.code != 200) return@launch
            val remaining = resp.songs.orEmpty().mapNotNull { it.toSongInfoOrNull() }
            if (remaining.isEmpty()) return@launch
            withContext(Dispatchers.Main) {
                listAdapter.appendFromApi(
                    rows = remaining,
                    apiTotal = totalCount,
                    apiPage = 2,
                    apiPageSize = totalCount,
                )
                syncStickyPlayAllTrackCount()
            }
        }
    }

    companion object {
        /** 首屏快速显示的歌曲数 */
        private const val FIRST_PAGE_SIZE = 30

        private const val EXTRA_PLAYLIST_ID = "playlist_id"
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_COVER_URL = "cover_url"
        private const val EXTRA_PLAY_COUNT_LABEL = "play_count_label"
        private const val EXTRA_TRACK_COUNT = "track_count"
        private const val EXTRA_STORAGE_TYPE = "storage_type"

        fun start(
            context: Context,
            playlistId: String,
            title: String,
            coverUrl: String,
            playCountLabel: String,
            trackCount: Int,
            storageType: CollectedPlaylistType,
        ) {
            val i = Intent(context, WyPlaylistDetailActivity::class.java).apply {
                putExtra(EXTRA_PLAYLIST_ID, playlistId)
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_COVER_URL, coverUrl)
                putExtra(EXTRA_PLAY_COUNT_LABEL, playCountLabel)
                putExtra(EXTRA_TRACK_COUNT, trackCount)
                putExtra(EXTRA_STORAGE_TYPE, storageType.name)
            }
            context.startActivity(i)
            (context as? Activity)?.overridePendingTransition(
                R.anim.slide_to_left,
                R.anim.dim_and_scale_out,
            )
        }
    }
}
