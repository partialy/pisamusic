package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import androidx.activity.addCallback
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.core.widget.ImageViewCompat
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityLovedSongsSearchBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.playlistdetail.PlaylistDetailContentAdapter
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/** “我的收藏”独立搜索页；结果过滤展示，播放队列始终使用完整收藏列表。 */
@AndroidEntryPoint
class LovedSongsSearchActivity : BaseDownloadActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityLovedSongsSearchBinding
    private lateinit var contentAdapter: PlaylistDetailContentAdapter
    private var miniPlayerBinder: HomeMiniPlayerBinder? = null
    private var allSongs: List<SongInfo> = emptyList()
    private var query: String = ""
    private var shouldRequestInitialFocus = true

    override fun onCreate(savedInstanceState: Bundle?) {
        shouldRequestInitialFocus = savedInstanceState == null
        binding = ActivityLovedSongsSearchBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)
        applyInsets()
        setupHeader()
        setupResults()

        onBackPressedDispatcher.addCallback(this) { finishAnimated() }

        miniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@LovedSongsSearchActivity)
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                loveManager.loveListFlow.collect { songs ->
                    allSongs = songs
                    contentAdapter.setStaticSongs(songs, R.string.loved_songs_empty_hint)
                    contentAdapter.setSearchQuery(query)
                    updateSearchResultState()
                }
            }
        }
    }

    override fun onEnterAnimationComplete() {
        super.onEnterAnimationComplete()
        if (!shouldRequestInitialFocus) return
        shouldRequestInitialFocus = false
        binding.searchInput.post {
            if (isFinishing || isDestroyed) return@post
            binding.searchInput.requestFocus()
            getSystemService(InputMethodManager::class.java)
                ?.showSoftInput(binding.searchInput, InputMethodManager.SHOW_IMPLICIT)
        }
    }

    private fun setupHeader() {
        binding.cancelButton.setOnClickListener { finishAnimated() }
        binding.clearSearchButton.setOnClickListener { binding.searchInput.text?.clear() }
        binding.searchInput.doAfterTextChanged { editable ->
            query = editable?.toString().orEmpty().trim()
            binding.clearSearchButton.isVisible = !editable.isNullOrEmpty()
            contentAdapter.setSearchQuery(query)
            updateSearchResultState()
        }
        binding.searchInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId != EditorInfo.IME_ACTION_SEARCH) return@setOnEditorActionListener false
            getSystemService(InputMethodManager::class.java)
                ?.hideSoftInputFromWindow(binding.searchInput.windowToken, 0)
            binding.searchInput.clearFocus()
            true
        }
    }

    private fun setupResults() {
        contentAdapter = PlaylistDetailContentAdapter(
            onSongClick = ::playFromSong,
            isSongLiked = loveManager::isSongInLoveList,
            onLoveClick = { loveManager.toggleLikeStatus(it) },
            onDownloadClick = ::onDownloadClick,
            onMoreClick = ::openSongMoreMenu,
        )
        binding.searchResultsRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@LovedSongsSearchActivity)
            adapter = contentAdapter
            itemAnimator = null
        }
        contentAdapter.setStaticSongs(emptyList(), R.string.loved_songs_empty_hint)

        binding.playAllBar.sortPlaylistButton.isVisible = false
        binding.playAllBar.batchPlaylistButton.isVisible = false
        binding.playAllBar.stickyPlayAllRow.setOnClickListener { }
        binding.playAllBar.btnPlayAllSticky.setOnClickListener {
            allSongs.takeIf { it.isNotEmpty() }?.let(musicController::setPlayList)
        }
        ImageViewCompat.setImageTintList(
            binding.playAllBar.btnPlayAllSticky,
            ColorStateList.valueOf(ContextCompat.getColor(this, R.color.primary)),
        )
    }

    private fun updateSearchResultState() {
        val hasQuery = query.isNotEmpty()
        binding.playAllBar.root.isVisible = hasQuery
        binding.searchResultsRecyclerView.isVisible = hasQuery
        binding.playAllBar.trackCountTextViewSticky.text = "${contentAdapter.visibleSongCount}首"
    }

    private fun playFromSong(song: SongInfo) {
        val startIndex = allSongs.indexOfFirst { it.type == song.type && it.id == song.id }
        if (startIndex < 0) return
        musicController.setPlayListLazy(allSongs, startIndex)
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

    private fun applyInsets() {
        val miniBottomBase = resources.getDimensionPixelSize(R.dimen.home_mini_player_bottom_margin)
        val overlapPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_overlap)
        val miniHeightPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_height)
        binding.root.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            val miniLayoutParams = binding.homeMiniPlayer.root.layoutParams as ConstraintLayout.LayoutParams
            miniLayoutParams.bottomMargin = miniBottomBase + overlapPx + insets.bottom
            binding.homeMiniPlayer.root.layoutParams = miniLayoutParams
            binding.searchResultsRecyclerView.updatePadding(
                bottom = miniHeightPx + miniBottomBase + insets.bottom,
            )
        }
    }

    private fun finishAnimated() {
        finish()
        AppActivityTransitions.applyBack(this)
    }

    override fun onDestroy() {
        miniPlayerBinder?.onDestroy()
        miniPlayerBinder = null
        super.onDestroy()
    }

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, LovedSongsSearchActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
