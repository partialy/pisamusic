package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.annotation.OptIn
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.ConcatAdapter
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding
import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.dialog.PlaylistActionBottomSheet
import cn.partialy.pm.ui.dialog.ShareBottomSheet
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

/** “我的收藏”详情：复用统一歌单详情 Header、歌曲列表和播放交互。 */
@AndroidEntryPoint
class LovedSongsPlaylistActivity : BaseDownloadActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityPlaylistDetailBinding
    private var miniPlayerBinder: HomeMiniPlayerBinder? = null

    private val headerAdapter = PlaylistDetailHeaderAdapter()
    private lateinit var contentAdapter: PlaylistDetailContentAdapter
    private lateinit var interactionController: PlaylistDetailInteractionController

    private fun createContentAdapter() = PlaylistDetailContentAdapter(
        onSongClick = ::playFromSong,
        isSongLiked = { loveManager.isSongInLoveList(it) },
        onLoveClick = { loveManager.toggleLikeStatus(it) },
        onDownloadClick = ::onDownloadClick,
        onMoreClick = ::openSongMoreMenu,
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
                    if (::interactionController.isInitialized && interactionController.closeSearchIfOpen()) return
                    finishAnimated()
                }
            },
        )

        val baseHeaderHeightPx = (56f * resources.displayMetrics.density).toInt().coerceAtLeast(1)

        ViewCompat.setOnApplyWindowInsetsListener(binding.headerBar) { view, insets ->
            val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            view.layoutParams = view.layoutParams.apply { height = baseHeaderHeightPx + top }
            binding.headerBarContent.updatePadding(top = top)
            insets
        }

        binding.backButton.setOnClickListener { finishAnimated() }
        binding.shareButton.setOnClickListener {
            ShareBottomSheet.showPlaylist(this, buildLovedSongsCanonical())
        }
        binding.moreButton.setOnClickListener {
            PlaylistActionBottomSheet.show(
                activity = this,
                playlist = buildLovedSongsCanonical(),
            )
        }

        contentAdapter = createContentAdapter()
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@LovedSongsPlaylistActivity)
            adapter = ConcatAdapter(headerAdapter, contentAdapter)
            itemAnimator = null
        }
        headerAdapter.updateHeader(
            title = getString(R.string.my_favorites),
            description = getString(R.string.my_favorites_playlist_intro),
            artwork = PlaylistHeaderArtwork.DrawableRes(R.drawable.my_favorites_cover_peach),
            trackCountText = getString(R.string.playlist_zero_tracks),
        )
        headerAdapter.setSearchEnabled(false)
        headerAdapter.updateCollectionState(
            visible = true,
            enabled = false,
            collected = true,
        )
        contentAdapter.setStaticSongs(emptyList(), R.string.loved_songs_empty_hint)

        val playAll: () -> Unit = {
            contentAdapter.currentSongs.takeIf { it.isNotEmpty() }?.let(musicController::setPlayList)
        }
        interactionController = PlaylistDetailInteractionController.attach(
            activity = this,
            binding = binding,
            headerAdapter = headerAdapter,
            contentAdapter = contentAdapter,
            onPlayAll = playAll,
            onToggleCollect = {},
            onSearchRequested = { LovedSongsSearchActivity.start(this) },
        )

        miniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@LovedSongsPlaylistActivity)
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                loveManager.loveListFlow.collect { songs ->
                    headerAdapter.updateHeader(
                        trackCountText = getString(R.string.playlist_track_count_compact, songs.size),
                    )
                    contentAdapter.setStaticSongs(songs, R.string.loved_songs_empty_hint)
                }
            }
        }
    }

    private fun buildLovedSongsCanonical(): CanonicalPlaylist = CanonicalPlaylist(
        id = "favorite_songs",
        source = "local",
        name = getString(R.string.my_favorites),
        desc = getString(R.string.my_favorites_playlist_intro),
        cover = "",
        song_count = contentAdapter.currentSongs.size,
    )

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
        musicController.setPlayListLazy(songs, startIndex = index)
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
        fun start(context: Context) {
            context.startActivity(Intent(context, LovedSongsPlaylistActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
