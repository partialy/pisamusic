package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.content.res.ColorStateList
import android.os.Bundle
import android.widget.Toast
import android.view.View
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
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
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

@AndroidEntryPoint
class PlaylistDetailActivity : BaseDownloadActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityPlaylistDetailBinding

    private var miniPlayerBinder: HomeMiniPlayerBinder? = null

    private var pagingPlaylistId: String = ""
    /** 酷狗歌单接口返回的曲目总数 */
    private var playlistApiTotalCount: Int = 0
    /** 后台全量加载协程 */
    private var allTracksLoadJob: Job? = null

    /**
     * 列表滚动量用于顶栏 alpha / 吸顶条。首项很高时 [RecyclerView.computeVerticalScrollOffset]
     * 与部分帧的 [getDecoratedTop] 会毛刺：往下滚时 offset 偶发变小、**往上滚时偶发偏小**，
     * 若用 [minOf] 直接吃进偏小值，顶栏会短暂半透明、吸顶「播放全部」消失。
     * 在 [mergeToolbarScrollStable] 里按本帧 [dy] 限制单步变化，过滤与手指位移不匹配的跳变。
     */
    private var toolbarScrollOffsetStablePx: Int = 0
    private var stickyPlayAllShown: Boolean = false
    /** 与返回/更多一致；未收藏歌单时爱心用此色，已收藏时用红色。 */
    private var lastHeaderIconTint: Int = android.graphics.Color.WHITE

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

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = false, lightNavigationBarIcons = true)
        applyPlaylistDetailInsets()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(enabled = true) {
                override fun handleOnBackPressed() {
                    finishAnimated()
                }
            },
        )

        val baseHeaderHeightPx = (56f * resources.displayMetrics.density).toInt().coerceAtLeast(1)
        val isDarkMode =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val insetsController = WindowInsetsControllerCompat(window, binding.root)

        fun applyStatusBarIconStyle(headerAlpha: Float) {
            if (isDarkMode) {
                insetsController.isAppearanceLightStatusBars = false
                return
            }
            insetsController.isAppearanceLightStatusBars = headerAlpha >= 0.5f
        }

        ViewCompat.setOnApplyWindowInsetsListener(binding.headerBar) { v, insets ->
            val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            v.layoutParams = v.layoutParams.apply { height = baseHeaderHeightPx + top }
            binding.headerBarContent.updatePadding(top = top)
            insets
        }

        binding.backButton.setOnClickListener { finishAnimated() }
        binding.playlistCollectButton.setOnClickListener { togglePlaylistCollect() }
        binding.moreButton.setOnClickListener {
            val pl = playlistCollectionManager.findKgLikeCollected(pagingPlaylistId)
            if (pl == null) {
                Toast.makeText(this, R.string.mine_playlist_delete_not_collected, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            MinePlaylistMoreBottomSheet.show(this, pl, playlistCollectionManager) {
                finishAnimated()
            }
        }

        listAdapter.onHeaderUpdated = {
            syncStickyPlayAllTrackCount()
            syncHeaderBarPlaylistTitle()
        }

        val coverUrl = intent.getStringExtra(EXTRA_COVER_URL).orEmpty()
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "歌单" }
        val desc = intent.getStringExtra(EXTRA_PLAY_COUNT_LABEL).orEmpty().ifBlank { "歌单描述" }
        val trackCount = intent.getIntExtra(EXTRA_TRACK_COUNT, 0)
        val playlistId = intent.getStringExtra(EXTRA_PLAYLIST_ID).orEmpty()

        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@PlaylistDetailActivity)
            adapter = listAdapter
            itemAnimator = null
        }
        // 先用 Intent 里的信息填充 Header，保证页面立刻可见
        listAdapter.updateHeader(
            title = title,
            desc = desc,
            coverUrl = coverUrl,
            trackCountText = if (trackCount > 0) "${trackCount}首" else "",
        )
        listAdapter.showInitialLoading()

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
                    prev = toolbarScrollOffsetStablePx,
                    raw = raw,
                    dy = dy,
                )
                val a = (toolbarScrollOffsetStablePx.toFloat() / triggerPx).coerceIn(0f, 1f)
                val barOpaque = a >= 1f
                binding.headerBg.alpha = a
                applyStatusBarIconStyle(a)
                val iconTint = if (a < 0.5f) android.R.color.white else R.color.home_tab_unselected
                val color = ContextCompat.getColor(this@PlaylistDetailActivity, iconTint)
                lastHeaderIconTint = color
                binding.backButton.setColorFilter(color)
                applyPlaylistCollectButtonTint()
                binding.moreButton.setColorFilter(color)
                binding.playlistTitleHeaderTextView.isVisible = barOpaque
                applyStickyPlayAllVisibility(barOpaque)
                tryLoadMoreTracks()
            }
        })
        binding.headerBg.alpha = 0f
        applyStatusBarIconStyle(0f)
        lastHeaderIconTint = ContextCompat.getColor(this, android.R.color.white)
        binding.backButton.setColorFilter(lastHeaderIconTint)
        applyPlaylistCollectButtonTint()
        binding.moreButton.setColorFilter(lastHeaderIconTint)
        binding.playlistTitleHeaderTextView.isVisible = false

        miniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@PlaylistDetailActivity)
        }

        lifecycleScope.launch {
            loveManager.loveListFlow.collect {
                listAdapter.notifyDataSetChanged()
            }
        }
        lifecycleScope.launch {
            playlistCollectionManager.playlistsFlow.collect {
                syncPlaylistCollectButton()
            }
        }

        if (playlistId.startsWith("collection_")) {
            pagingPlaylistId = playlistId
            binding.playlistCollectButton.isVisible = true
            syncPlaylistCollectButton()
            lifecycleScope.launch {
                loadPlaylistInitial(playlistId = playlistId, fallbackCoverUrl = coverUrl)
            }
        } else {
            binding.playlistCollectButton.isVisible = false
            listAdapter.setFirstPageFailed()
        }
    }

    private fun isKgPlaylistCollected(): Boolean =
        playlistCollectionManager.isCollected(CollectedPlaylistType.KG, pagingPlaylistId) ||
            playlistCollectionManager.isCollected(CollectedPlaylistType.IMPORT_KG, pagingPlaylistId)

    private fun applyPlaylistCollectButtonTint() {
        if (!binding.playlistCollectButton.isVisible) return
        val collected = pagingPlaylistId.startsWith("collection_") && isKgPlaylistCollected()
        val tint = if (collected) {
            ContextCompat.getColor(this, R.color.red)
        } else {
            lastHeaderIconTint
        }
        binding.playlistCollectButton.setColorFilter(tint)
    }

    private fun syncPlaylistCollectButton() {
        if (!pagingPlaylistId.startsWith("collection_")) return
        val collected = isKgPlaylistCollected()
        binding.playlistCollectButton.setImageResource(
            if (collected) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
        )
        applyPlaylistCollectButtonTint()
    }

    private fun buildKgCollectedPlaylistForStorage(): CollectedPlaylist {
        val count = when {
            playlistApiTotalCount > 0 -> playlistApiTotalCount
            else -> listAdapter.currentSongs.size
        }
        return CollectedPlaylist(
            type = CollectedPlaylistType.KG,
            id = pagingPlaylistId,
            name = listAdapter.headerTitleText,
            intro = listAdapter.headerDescText,
            cover = listAdapter.headerCoverUrl,
            count = count.coerceAtLeast(0),
        )
    }

    private fun togglePlaylistCollect() {
        if (!pagingPlaylistId.startsWith("collection_")) return
        when {
            playlistCollectionManager.isCollected(CollectedPlaylistType.KG, pagingPlaylistId) ->
                playlistCollectionManager.removePlaylist(CollectedPlaylistType.KG, pagingPlaylistId)
            playlistCollectionManager.isCollected(CollectedPlaylistType.IMPORT_KG, pagingPlaylistId) ->
                playlistCollectionManager.removePlaylist(CollectedPlaylistType.IMPORT_KG, pagingPlaylistId)
            else ->
                playlistCollectionManager.addNetworkPlaylist(buildKgCollectedPlaylistForStorage())
        }
        syncPlaylistCollectButton()
    }

    private fun syncStickyPlayAllTrackCount() {
        binding.stickyPlayAllBar.trackCountTextViewSticky.text = listAdapter.headerTrackCountText
    }

    private fun syncHeaderBarPlaylistTitle() {
        binding.playlistTitleHeaderTextView.text = listAdapter.headerTitleText
    }

    /**
     * 将本帧读到的 [raw] 与上一帧 [prev] 合并：只允许与 [dy] 量级一致的变化，
     * 避免 RecyclerView 在首项边界处单帧报告离谱 offset。
     */
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
                    minOf(prev, raw)
                }
            }
            dy > 0 -> {
                val rise = raw - prev
                if (raw > prev && rise > dy + slack && dy * 2 < rise) {
                    prev
                } else {
                    maxOf(prev, raw)
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

    @Suppress("UNUSED_PARAMETER")
    private fun tryLoadMoreTracks() {
        // 已改为后台全量加载，不再需要滚动分页
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

    /**
     * 清空队列并从所点歌曲起播：当前曲立即拉 URL，其后已加载的曲目与后续分页均以占位入队（不预取 URL）。
     * [adapterPosition] 为 RecyclerView 位置（0 为头图，歌曲从 1 起）。
     */
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

    private suspend fun loadPlaylistInitial(playlistId: String, fallbackCoverUrl: String) {
        kgRepository.getPlaylistDetail(listOf(playlistId))
            .onSuccess { resp ->
                val item = resp.data.firstOrNull()
                if (item != null) {
                    val t = item.name.ifBlank { "" }
                    val d = item.intro.ifBlank { item.tags }.ifBlank { "" }
                    val cover = item.pic.ifBlank { fallbackCoverUrl }.replace("{size}", "240")
                    withContext(Dispatchers.Main) {
                        listAdapter.updateHeader(title = t, desc = d, coverUrl = cover)
                    }
                }
            }

        val first = withContext(Dispatchers.IO) {
            kgRepository.getPlaylistTrackAll(
                id = playlistId,
                page = 1,
                pagesize = FIRST_PAGE_SIZE,
            ).getOrNull()?.data
        }
        withContext(Dispatchers.Main) {
            if (first == null) {
                listAdapter.setFirstPageFailed()
                return@withContext
            }
            val mapped = first.info.mapNotNull { it.toSongInfoOrNull() }
            val total = first.count
            playlistApiTotalCount = total
            val label = if (total > 0) "${total}首" else "${mapped.size}首"
            listAdapter.updateHeader(trackCountText = label)
            listAdapter.setFirstPageSuccess(
                rows = mapped,
                apiTotal = total,
                apiPage = 1,
                apiPageSize = FIRST_PAGE_SIZE,
            )
            syncPlaylistCollectButton()
            if (total > mapped.size) {
                loadAllRemainingTracks(playlistId, total)
            }
        }
    }

    /** 一次性加载歌单全部剩余歌曲 */
    private fun loadAllRemainingTracks(playlistId: String, totalCount: Int) {
        allTracksLoadJob?.cancel()
        allTracksLoadJob = lifecycleScope.launch {
            val data = withContext(Dispatchers.IO) {
                kgRepository.getPlaylistTrackAll(
                    id = playlistId,
                    page = 1,
                    pagesize = maxOf(totalCount, 5000),
                ).getOrNull()?.data
            } ?: return@launch
            val allSongs = data.info.mapNotNull { it.toSongInfoOrNull() }
            if (allSongs.size <= listAdapter.currentSongs.size) return@launch
            withContext(Dispatchers.Main) {
                listAdapter.replaceAllSongs(allSongs)
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

        fun start(
            context: Context,
            playlistId: String,
            title: String,
            coverUrl: String,
            playCountLabel: String,
            trackCount: Int = 0,
        ) {
            val i = Intent(context, PlaylistDetailActivity::class.java).apply {
                putExtra(EXTRA_PLAYLIST_ID, playlistId)
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_COVER_URL, coverUrl)
                putExtra(EXTRA_PLAY_COUNT_LABEL, playCountLabel)
                putExtra(EXTRA_TRACK_COUNT, trackCount)
            }
            context.startActivity(i)
            (context as? Activity)?.overridePendingTransition(
                R.anim.slide_to_left,
                R.anim.dim_and_scale_out,
            )
        }
    }
}

private fun cn.partialy.pm.model.KgPlaylistTrackRow.toSongInfoOrNull(): SongInfo? {
    val id = hash.trim()
    if (id.isEmpty()) return null

    val coverUrl = cover.replace("{size}", "120")
    val (artist, title) = run {
        val fromSinger = singerinfo.map { it.name.trim() }.filter { it.isNotEmpty() }
        if (fromSinger.isNotEmpty()) {
            val rawTitle = name.substringAfter(" - ", missingDelimiterValue = name).trim()
            fromSinger.joinToString("、") to rawTitle.ifBlank { name }
        } else {
            val parts = name.split(" - ", limit = 2)
            if (parts.size == 2) parts[0].trim() to parts[1].trim() else "" to name
        }
    }
    return SongInfo(
        id = id,
        type = SongType.KG,
        name = title.ifBlank { name },
        artist = artist,
        album = albuminfo?.name,
        coverUrl = coverUrl,
        duration = (timelen / 1000).coerceAtLeast(0),
        lyric = null,
    )
}
