package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import androidx.activity.OnBackPressedCallback
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.toCanonicalPlaylist
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.network.cookie.model.toSongInfoOrNull
import cn.partialy.pm.ui.dialog.PlaylistActionBottomSheet
import cn.partialy.pm.ui.dialog.ShareBottomSheet
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.playlistdetail.PlaylistDetailContentAdapter
import cn.partialy.pm.ui.playlistdetail.PlaylistDetailHeaderController
import cn.partialy.pm.ui.playlistdetail.PlaylistDetailInteractionController
import cn.partialy.pm.ui.playlistdetail.PlaylistHeaderArtwork
import cn.partialy.pm.ui.widget.observeSongListPlaybackState
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

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

    private lateinit var headerController: PlaylistDetailHeaderController
    private lateinit var contentAdapter: PlaylistDetailContentAdapter
    private lateinit var interactionController: PlaylistDetailInteractionController

    private fun createContentAdapter() = PlaylistDetailContentAdapter(
        onSongClick = ::playPlaylistFromSong,
        isSongLiked = { loveManager.isSongInLoveList(it) },
        onLoveClick = { song ->
            loveManager.toggleLikeStatus(song)
            contentAdapter.notifySongChanged(song)
        },
        onDownloadClick = ::onDownloadClick,
        onMoreClick = ::openSongMoreMenu,
    )

    @OptIn(UnstableApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityPlaylistDetailBinding.inflate(layoutInflater)
        headerController = PlaylistDetailHeaderController(binding.playlistHeader)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        if (!parseIntentArgs()) return

        setupSystemBars()
        setupHeaderBar()
        contentAdapter = createContentAdapter()
        observeSongListPlaybackState(musicController, contentAdapter)
        setupListView()
        setupPlayAllButtons()
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
            override fun handleOnBackPressed() {
                if (::interactionController.isInitialized && interactionController.closeSearchIfOpen()) return
                finishAnimated()
            }
        })
    }

    /** 顶栏按钮点击 */
    private fun setupHeaderBar() {
        binding.backButton.setOnClickListener { finishAnimated() }
        binding.shareButton.setOnClickListener {
            ShareBottomSheet.showPlaylist(
                this,
                buildWyCollectedPlaylistForStorage().toCanonicalPlaylist(),
            )
        }
        binding.moreButton.setOnClickListener {
            val playlist = buildWyCollectedPlaylistForStorage()
            val deleteTarget = playlistCollectionManager.findWyLikeCollected(pagingPlaylistId)
            PlaylistActionBottomSheet.show(
                activity = this,
                playlist = playlist.toCanonicalPlaylist(),
                deleteTarget = deleteTarget,
                manager = playlistCollectionManager,
                onDeleted = { finishAnimated() },
            )
        }
    }

    /** RecyclerView + Adapter + 用 Intent 数据填充初始 Header */
    private fun setupListView() {
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@WyPlaylistDetailActivity)
            adapter = contentAdapter
            itemAnimator = null
        }

        headerController.updateHeader(
            title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { getString(R.string.playlist_default_title) },
            description = intent.getStringExtra(EXTRA_PLAY_COUNT_LABEL).orEmpty()
                .ifBlank { getString(R.string.playlist_default_description) },
            artwork = PlaylistHeaderArtwork.Remote(intent.getStringExtra(EXTRA_COVER_URL).orEmpty()),
            trackCountText = if (playlistTrackTotalHint > 0) {
                getString(R.string.playlist_track_count_compact, playlistTrackTotalHint)
            } else {
                ""
            },
        )
        contentAdapter.showInitialLoading()
    }

    /** 绑定唯一的“播放全部”吸顶工具条。 */
    private fun setupPlayAllButtons() {
        val playAll: () -> Unit = {
            val list = contentAdapter.currentSongs
            if (list.isNotEmpty()) {
                musicController.setPlayListLazy(list, startIndex = 0, sourceId = pagingPlaylistId)
                ensurePlaylistEnriched()
            }
        }
        interactionController = PlaylistDetailInteractionController.attach(
            activity = this,
            binding = binding,
            headerController = headerController,
            contentAdapter = contentAdapter,
            onPlayAll = playAll,
            onToggleCollect = ::togglePlaylistCollect,
            onSearchRequested = {
                val songs = contentAdapter.currentSongs
                PlaylistSongsSearchActivity.start(
                    context = this,
                    songs = songs,
                    title = headerController.state.title,
                    sourceId = pagingPlaylistId,
                )
            },
        )
        syncPlaylistCollectButton()
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
                    contentAdapter.notifyDataSetChanged()
                }
            }
        }
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

    private fun syncPlaylistCollectButton() {
        val supported = pagingPlaylistId.isNotBlank()
        headerController.updateCollectionState(
            visible = true,
            enabled = supported,
            collected = supported && isWyPlaylistCollected(),
        )
    }

    private fun buildWyCollectedPlaylistForStorage(): CollectedPlaylist {
        val count = when {
            playlistTrackTotalHint > 0 -> playlistTrackTotalHint
            else -> contentAdapter.currentSongs.size
        }
        return CollectedPlaylist(
            type = storageType,
            id = pagingPlaylistId,
            name = headerController.state.title,
            intro = headerController.state.description,
            cover = (headerController.state.artwork as? PlaylistHeaderArtwork.Remote)?.url.orEmpty(),
            count = count.coerceAtLeast(0),
        )
    }

    private fun togglePlaylistCollect() {
        if (pagingPlaylistId.isBlank()) return
        when {
            playlistCollectionManager.isCollected(CollectedPlaylistType.WY, pagingPlaylistId) ->
                playlistCollectionManager.removePlaylist(CollectedPlaylistType.WY, pagingPlaylistId)
            playlistCollectionManager.isCollected(CollectedPlaylistType.IMPORT_WY, pagingPlaylistId) ->
                playlistCollectionManager.removePlaylist(CollectedPlaylistType.IMPORT_WY, pagingPlaylistId)
            else ->
                playlistCollectionManager.addNetworkPlaylist(buildWyCollectedPlaylistForStorage())
        }
        syncPlaylistCollectButton()
    }

    private fun applyPlaylistDetailInsets() {
        val miniBottomBase = resources.getDimensionPixelSize(R.dimen.home_mini_player_bottom_margin)
        val overlapPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_overlap)
        val miniHeightPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_height)
        binding.root.applySystemBarsInsets { insets ->
            binding.recyclerView.updatePadding(
                bottom = miniHeightPx + miniBottomBase + insets.bottom,
            )
            binding.homeMiniPlayer.root.updateLayoutParams<ViewGroup.MarginLayoutParams> {
                bottomMargin = miniBottomBase + overlapPx + insets.bottom
            }
        }
    }

    private fun finishAnimated() {
        finish()
        AppActivityTransitions.applyBack(this)
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

    private fun playPlaylistFromSong(song: SongInfo) {
        val songs = contentAdapter.currentSongs
        val idx = songs.indexOfFirst { it.id == song.id && it.type == song.type }
        if (idx < 0) return
        musicController.setPlayListLazy(songs, startIndex = idx, sourceId = pagingPlaylistId)
        ensurePlaylistEnriched()
    }

    /** 如果播放队列比 adapter 少（后台还没加载完时点击），把差量补上 */
    private fun ensurePlaylistEnriched() {
        val adapterSongs = contentAdapter.currentSongs
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
                contentAdapter.setFirstPageFailed()
                return@withContext
            }
            val mapped = first.songs.orEmpty().mapNotNull { it.toSongInfoOrNull() }
            val apiTotal = playlistTrackTotalHint
            val label = when {
                apiTotal > 0 -> getString(R.string.playlist_track_count_compact, apiTotal)
                mapped.isNotEmpty() -> getString(R.string.playlist_track_count_compact, mapped.size)
                else -> ""
            }
            headerController.updateHeader(trackCountText = label)
            contentAdapter.setFirstPageSuccess(
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
                contentAdapter.appendFromApi(
                    rows = remaining,
                    apiTotal = totalCount,
                    apiPage = 2,
                    apiPageSize = totalCount,
                )
            }
        }
    }

    override fun onDestroy() {
        if (::interactionController.isInitialized) {
            interactionController.dispose()
        }
        if (::headerController.isInitialized) headerController.dispose()
        miniPlayerBinder?.onDestroy()
        miniPlayerBinder = null
        allTracksLoadJob?.cancel()
        super.onDestroy()
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
            AppActivityTransitions.applyForward(context)
        }
    }
}
