package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.annotation.OptIn
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
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.toCanonicalPlaylist
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
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 自建本地歌单详情：复用统一歌单详情 Header、搜索和交互模块。 */
@AndroidEntryPoint
class LocalPlaylistDetailActivity : BaseDownloadActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityPlaylistDetailBinding
    private lateinit var playlistId: String
    private var miniPlayerBinder: HomeMiniPlayerBinder? = null

    private lateinit var headerController: PlaylistDetailHeaderController
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
        headerController = PlaylistDetailHeaderController(binding.playlistHeader)
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

        binding.backButton.setOnClickListener { finishAnimated() }
        binding.shareButton.setOnClickListener {
            val playlist = currentLocalPlaylist() ?: return@setOnClickListener
            ShareBottomSheet.showPlaylist(this, playlist.toCanonicalPlaylist())
        }
        binding.moreButton.setOnClickListener {
            val playlist = currentLocalPlaylist()
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
        observeSongListPlaybackState(musicController, contentAdapter)
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@LocalPlaylistDetailActivity)
            adapter = contentAdapter
            itemAnimator = null
        }
        headerController.updateHeader(
            title = getString(R.string.mine_tab_playlists),
            artwork = PlaylistHeaderArtwork.LocalPlaylist(""),
            trackCountText = getString(R.string.playlist_zero_tracks),
        )
        headerController.updateCollectionState(
            visible = true,
            enabled = false,
            collected = true,
        )
        contentAdapter.setStaticSongs(emptyList(), R.string.local_playlist_empty_hint)

        val playAll: () -> Unit = {
            contentAdapter.currentSongs.takeIf { it.isNotEmpty() }?.let(musicController::setPlayList)
        }
        interactionController = PlaylistDetailInteractionController.attach(
            activity = this,
            binding = binding,
            headerController = headerController,
            contentAdapter = contentAdapter,
            onPlayAll = playAll,
            onToggleCollect = {},
            onSearchRequested = {
                val songs = contentAdapter.currentSongs
                PlaylistSongsSearchActivity.start(
                    context = this,
                    songs = songs,
                    title = headerController.state.title,
                )
            },
        )

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
                    headerController.updateHeader(
                        title = meta.name,
                        description = meta.intro,
                        artwork = PlaylistHeaderArtwork.LocalPlaylist(meta.cover),
                        trackCountText = getString(R.string.playlist_track_count_compact, songs.size),
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

    private fun currentLocalPlaylist() =
        playlistCollectionManager.getCollectedPlaylist(CollectedPlaylistType.LOCAL, playlistId)

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

    private fun applyPlaylistDetailInsets() {
        val miniBottomBase = resources.getDimensionPixelSize(R.dimen.home_mini_player_bottom_margin)
        val overlapPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_overlap)
        val miniHeightPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_height)
        binding.root.applySystemBarsInsets { insets ->
            binding.homeMiniPlayer.root.updateLayoutParams<ViewGroup.MarginLayoutParams> {
                bottomMargin = miniBottomBase + overlapPx + insets.bottom
            }
            binding.recyclerView.updatePadding(bottom = miniHeightPx + miniBottomBase + insets.bottom)
        }
    }

    private fun finishAnimated() {
        finish()
        AppActivityTransitions.applyBack(this)
    }

    override fun onDestroy() {
        if (::interactionController.isInitialized) interactionController.dispose()
        if (::headerController.isInitialized) headerController.dispose()
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
