package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Toast
import androidx.activity.addCallback
import androidx.activity.viewModels
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
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityLovedSongsSearchBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.cloudmusic.CloudMusicListAdapter
import cn.partialy.pm.ui.cloudmusic.CloudMusicViewModel
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/** 云盘专属独立搜索页；复用 activity_loved_songs_search 布局，默认展示全部云盘歌曲并支持滑动分页加载。 */
@AndroidEntryPoint
class CloudMusicSearchActivity : BaseDownloadActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityLovedSongsSearchBinding
    private val viewModel: CloudMusicViewModel by viewModels()
    private lateinit var listAdapter: CloudMusicListAdapter
    private var miniPlayerBinder: HomeMiniPlayerBinder? = null
    private var isSettingSearchText = false
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
            startObserving(this@CloudMusicSearchActivity)
        }

        observeState()
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
        binding.searchInput.hint = getString(R.string.cloud_music_search_hint)
        binding.cancelButton.setOnClickListener { finishAnimated() }
        binding.clearSearchButton.setOnClickListener {
            binding.searchInput.setText("")
            binding.clearSearchButton.isVisible = false
            viewModel.setKeyword("")
        }

        binding.searchInput.doAfterTextChanged { editable ->
            if (isSettingSearchText) return@doAfterTextChanged
            val query = editable?.toString().orEmpty().trim()
            binding.clearSearchButton.isVisible = !editable.isNullOrEmpty()
            viewModel.setKeyword(query)
        }

        binding.searchInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                hideKeyboard(binding.searchInput)
                viewModel.searchNow()
                true
            } else {
                false
            }
        }
    }

    private fun setupResults() {
        listAdapter = CloudMusicListAdapter(
            isSongLiked = loveManager::isSongInLoveList,
            onLoveClick = { song ->
                loveManager.toggleLikeStatus(song)
                listAdapter.notifySongChanged(song)
            },
            onSongClick = ::playSong,
            onDownloadClick = ::downloadSong,
            onMoreClick = ::showMoreMenu,
            onRetryFirstPage = viewModel::retryFirstPage,
            onRetryLoadMore = viewModel::loadMore,
        )

        binding.searchResultsRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@CloudMusicSearchActivity)
            adapter = listAdapter
            itemAnimator = null
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    if (dy <= 0) return
                    val lastVisible = (layoutManager as? LinearLayoutManager)
                        ?.findLastVisibleItemPosition()
                        ?: return
                    if (lastVisible >= listAdapter.itemCount - LOAD_MORE_THRESHOLD) {
                        viewModel.loadMore()
                    }
                }
            })
        }

        binding.playAllBar.sortPlaylistButton.isVisible = false
        binding.playAllBar.batchPlaylistButton.isVisible = false
        binding.playAllBar.stickyPlayAllRow.setOnClickListener { }
        binding.playAllBar.btnPlayAllSticky.setOnClickListener {
            val songs = viewModel.state.value.items.filter { it.playable }
            if (songs.isNotEmpty()) {
                musicController.setPlayList(songs)
            }
        }
        ImageViewCompat.setImageTintList(
            binding.playAllBar.btnPlayAllSticky,
            ColorStateList.valueOf(ContextCompat.getColor(this, R.color.primary)),
        )
    }

    private fun observeState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.state.collectLatest { state ->
                        binding.playAllBar.root.isVisible = state.items.isNotEmpty()
                        binding.searchResultsRecyclerView.isVisible = true
                        binding.playAllBar.trackCountTextViewSticky.text = getString(
                            R.string.playlist_track_count_compact,
                            state.items.size,
                        )

                        if (!binding.searchInput.hasFocus() && binding.searchInput.text?.toString() != state.keyword) {
                            isSettingSearchText = true
                            binding.searchInput.setText(state.keyword)
                            binding.searchInput.setSelection(state.keyword.length)
                            binding.clearSearchButton.isVisible = state.keyword.isNotEmpty()
                            isSettingSearchText = false
                        }

                        listAdapter.submitState(state)
                    }
                }

                launch {
                    loveManager.loveListFlow.collectLatest {
                        listAdapter.notifyDataSetChanged()
                    }
                }
            }
        }
    }

    private fun playSong(song: SongInfo) {
        if (!song.playable) {
            Toast.makeText(this, R.string.cloud_music_disabled_play, Toast.LENGTH_SHORT).show()
            return
        }
        val allPlayable = viewModel.state.value.items.filter { it.playable }
        val startIndex = allPlayable.indexOfFirst { it.type == song.type && it.id == song.id }
        if (startIndex >= 0) {
            musicController.setPlayListLazy(allPlayable, startIndex)
        } else {
            musicController.addToPlayList(song, autoPlay = true)
        }
    }

    private fun downloadSong(song: SongInfo) {
        if (!song.playable) {
            Toast.makeText(this, R.string.cloud_music_disabled_download, Toast.LENGTH_SHORT).show()
            return
        }
        startSongDownloadFlow(song)
    }

    private fun showMoreMenu(song: SongInfo) {
        SongMoreMenu.show(
            this,
            song,
            SongMoreMenuDependencies(
                musicController = musicController,
                loveManager = loveManager,
                playlistCollectionManager = playlistCollectionManager,
                onDownloadClick = ::downloadSong,
                showPlayNext = song.playable,
                showDownload = song.playable,
                allowQueueTarget = song.playable,
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

    private fun hideKeyboard(view: android.view.View) {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(view.windowToken, 0)
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
        private const val LOAD_MORE_THRESHOLD = 5

        fun start(context: Context) {
            context.startActivity(Intent(context, CloudMusicSearchActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
