package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.os.Bundle
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
import androidx.recyclerview.widget.ConcatAdapter
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.toCanonicalPlaylist
import cn.partialy.pm.ui.dialog.PlaylistActionBottomSheet
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.playlistdetail.PlaylistDetailContentAdapter
import cn.partialy.pm.ui.playlistdetail.PlaylistDetailHeaderAdapter
import cn.partialy.pm.ui.playlistdetail.PlaylistDetailInteractionController
import cn.partialy.pm.ui.playlistdetail.PlaylistHeaderArtwork
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.max
import kotlin.math.min

/** 自建本地歌单详情：复用统一歌单详情 Header、搜索和交互模块。 */
@AndroidEntryPoint
class LocalPlaylistDetailActivity : BaseDownloadActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityPlaylistDetailBinding
    private lateinit var playlistId: String
    private var miniPlayerBinder: HomeMiniPlayerBinder? = null
    private var toolbarScrollOffsetStablePx: Int = 0

    private val headerAdapter = PlaylistDetailHeaderAdapter()
    private lateinit var contentAdapter: PlaylistDetailContentAdapter
    private lateinit var interactionController: PlaylistDetailInteractionController

    private fun createContentAdapter() = PlaylistDetailContentAdapter(
        onSongClick = ::playFromSong,
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
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        playlistId = intent.getStringExtra(EXTRA_PLAYLIST_ID).orEmpty()
        if (playlistId.isBlank()) {
            finish()
            return
        }

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = false, lightNavigationBarIcons = true)
        applyPlaylistDetailInsets()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(enabled = true) {
                override fun handleOnBackPressed() {
                    if (::interactionController.isInitialized && interactionController.closeSearchIfOpen()) return
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

        ViewCompat.setOnApplyWindowInsetsListener(binding.headerBar) { view, insets ->
            val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            view.layoutParams = view.layoutParams.apply { height = baseHeaderHeightPx + top }
            binding.headerBarContent.updatePadding(top = top)
            insets
        }

        binding.playlistCollectButton.isVisible = false
        binding.backButton.setOnClickListener { finishAnimated() }
        binding.moreButton.setOnClickListener {
            val playlist = playlistCollectionManager.getCollectedPlaylist(CollectedPlaylistType.LOCAL, playlistId)
            if (playlist == null) {
                Toast.makeText(this, R.string.mine_playlist_delete_failed, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            PlaylistActionBottomSheet.show(
                activity = this,
                playlist = playlist.toCanonicalPlaylist(),
                deleteTarget = playlist,
                manager = playlistCollectionManager,
                onDeleted = { finishAnimated() },
            )
        }

        contentAdapter = createContentAdapter()
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@LocalPlaylistDetailActivity)
            adapter = ConcatAdapter(headerAdapter, contentAdapter)
            itemAnimator = null
        }
        headerAdapter.updateHeader(
            title = getString(R.string.mine_tab_playlists),
            artwork = PlaylistHeaderArtwork.LocalPlaylist(""),
            trackCountText = "0首",
        )
        contentAdapter.setStaticSongs(emptyList(), R.string.local_playlist_empty_hint)

        val playAll: () -> Unit = {
            contentAdapter.currentSongs.takeIf { it.isNotEmpty() }?.let(musicController::setPlayList)
        }
        interactionController = PlaylistDetailInteractionController.attach(
            activity = this,
            binding = binding,
            headerAdapter = headerAdapter,
            contentAdapter = contentAdapter,
            onPlayAll = playAll,
        )
        ImageViewCompat.setImageTintList(
            binding.stickyPlayAllBar.btnPlayAllSticky,
            ColorStateList.valueOf(ContextCompat.getColor(this, R.color.primary)),
        )

        val triggerPx = (180f * resources.displayMetrics.density).toInt().coerceAtLeast(1)
        binding.recyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                val layoutManager = recyclerView.layoutManager as? LinearLayoutManager ?: return
                val headerView = layoutManager.findViewByPosition(0)
                val raw = if (headerView != null) {
                    (recyclerView.paddingTop - layoutManager.getDecoratedTop(headerView)).coerceAtLeast(0)
                } else {
                    recyclerView.computeVerticalScrollOffset().coerceAtLeast(0)
                }
                toolbarScrollOffsetStablePx = mergeToolbarScrollStable(toolbarScrollOffsetStablePx, raw, dy)
                val alpha = (toolbarScrollOffsetStablePx.toFloat() / triggerPx).coerceIn(0f, 1f)
                val barOpaque = alpha >= 1f
                binding.headerBg.alpha = alpha
                applyStatusBarIconStyle(alpha)
                val iconTint = if (alpha < 0.5f) android.R.color.white else R.color.home_tab_unselected
                val color = ContextCompat.getColor(this@LocalPlaylistDetailActivity, iconTint)
                binding.backButton.setColorFilter(color)
                binding.moreButton.setColorFilter(color)
                binding.playlistTitleHeaderTextView.isVisible = barOpaque
                interactionController.setStickyVisible(barOpaque)
            }
        })
        binding.headerBg.alpha = 0f
        applyStatusBarIconStyle(0f)
        val white = ContextCompat.getColor(this, android.R.color.white)
        binding.backButton.setColorFilter(white)
        binding.moreButton.setColorFilter(white)
        binding.playlistTitleHeaderTextView.isVisible = false

        miniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@LocalPlaylistDetailActivity)
        }

        playlistCollectionManager.getAllPlaylists()
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                playlistCollectionManager.playlistsFlow.collect { playlists ->
                    val meta = playlists.find {
                        it.type == CollectedPlaylistType.LOCAL && it.id == playlistId
                    }
                    if (meta == null) {
                        finishAnimated()
                        return@collect
                    }
                    val songs = playlistCollectionManager.getLocalPlaylistSongs(playlistId)
                    headerAdapter.updateHeader(
                        title = meta.name,
                        description = meta.intro,
                        artwork = PlaylistHeaderArtwork.LocalPlaylist(meta.cover),
                        trackCountText = "${songs.size}首",
                    )
                    contentAdapter.setStaticSongs(songs, R.string.local_playlist_empty_hint)
                }
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                loveManager.loveListFlow.collect { contentAdapter.notifyDataSetChanged() }
            }
        }
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

    private fun playFromSong(song: SongInfo) {
        val songs = contentAdapter.currentSongs
        val index = songs.indexOfFirst { it.id == song.id && it.type == song.type }
        if (index < 0) return
        songs.subList(index, songs.size).takeIf { it.isNotEmpty() }?.let(musicController::setPlayList)
    }

    private fun mergeToolbarScrollStable(prev: Int, raw: Int, dy: Int): Int {
        val density = resources.displayMetrics.density
        val slack = (28f * density).toInt().coerceAtLeast(20)
        val layoutSlack = (72f * density).toInt().coerceAtLeast(56)
        return when {
            dy < 0 -> {
                val drop = prev - raw
                if (raw < prev && drop > (-dy) + slack && (-dy) * 2 < drop) prev else min(prev, raw)
            }
            dy > 0 -> {
                val rise = raw - prev
                if (raw > prev && rise > dy + slack && dy * 2 < rise) prev else max(prev, raw)
            }
            raw < prev - layoutSlack -> prev
            raw > prev + layoutSlack -> raw
            else -> raw
        }.coerceAtLeast(0)
    }

    private fun applyPlaylistDetailInsets() {
        val miniBottomBase = resources.getDimensionPixelSize(R.dimen.home_mini_player_bottom_margin)
        val overlapPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_overlap)
        val miniHeightPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_height)
        binding.root.applySystemBarsInsets { insets ->
            val layoutParams = binding.homeMiniPlayer.root.layoutParams as ConstraintLayout.LayoutParams
            layoutParams.bottomMargin = miniBottomBase + overlapPx + insets.bottom
            binding.homeMiniPlayer.root.layoutParams = layoutParams
            binding.recyclerView.updatePadding(bottom = miniHeightPx + miniBottomBase + insets.bottom)
        }
    }

    private fun finishAnimated() {
        finish()
        AppActivityTransitions.applyBack(this)
    }

    override fun onDestroy() {
        if (::interactionController.isInitialized) interactionController.dispose()
        miniPlayerBinder?.onDestroy()
        miniPlayerBinder = null
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_PLAYLIST_ID = "local_playlist_id"

        fun start(context: Context, playlistId: String) {
            if (playlistId.isBlank()) return
            val intent = Intent(context, LocalPlaylistDetailActivity::class.java).apply {
                putExtra(EXTRA_PLAYLIST_ID, playlistId)
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
