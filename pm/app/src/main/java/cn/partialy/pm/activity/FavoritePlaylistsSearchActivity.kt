package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import androidx.activity.addCallback
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.GridLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityFavoritePlaylistsSearchBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.HomeRecommendPlaylist
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.home.adapters.HomePlaylistGridAdapter
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/** “歌单收藏”独立搜索页；实时过滤收藏歌单，点击进入对应歌单详情。 */
@AndroidEntryPoint
class FavoritePlaylistsSearchActivity : BaseActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityFavoritePlaylistsSearchBinding
    private lateinit var adapter: HomePlaylistGridAdapter
    private var miniPlayerBinder: HomeMiniPlayerBinder? = null
    private var allPlaylists: List<CollectedPlaylist> = emptyList()
    private var query: String = ""
    private var shouldRequestInitialFocus = true

    override fun onCreate(savedInstanceState: Bundle?) {
        shouldRequestInitialFocus = savedInstanceState == null
        binding = ActivityFavoritePlaylistsSearchBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)
        applyInsets()
        setupHeader()
        setupResults()

        onBackPressedDispatcher.addCallback(this) { finishAnimated() }

        miniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@FavoritePlaylistsSearchActivity)
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                playlistCollectionManager.playlistsFlow.collect { list ->
                    allPlaylists = list.filter { it.type != CollectedPlaylistType.LOCAL }
                    updateSearchResultState()
                }
            }
        }
        playlistCollectionManager.preloadIndexFromDiskAsync()
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
        adapter = HomePlaylistGridAdapter { item -> openPlaylist(item) }
        binding.searchResultsRecyclerView.apply {
            layoutManager = GridLayoutManager(this@FavoritePlaylistsSearchActivity, 3)
            adapter = this@FavoritePlaylistsSearchActivity.adapter
        }
    }

    private fun updateSearchResultState() {
        val trimmed = query.trim()
        if (trimmed.isEmpty()) {
            binding.searchResultsRecyclerView.isVisible = false
            binding.emptyView.isVisible = false
            adapter.submitList(emptyList())
        } else {
            val filtered = allPlaylists
                .filter { it.name.contains(trimmed, ignoreCase = true) }
                .map { it.toHomePlaylist() }
            adapter.submitList(filtered)
            binding.searchResultsRecyclerView.isVisible = filtered.isNotEmpty()
            binding.emptyView.isVisible = filtered.isEmpty()
        }
    }

    private fun CollectedPlaylist.toHomePlaylist(): HomeRecommendPlaylist {
        val n = count.coerceAtLeast(0)
        return HomeRecommendPlaylist(
            id = id,
            name = name,
            coverUrl = cover,
            playCountLabel = if (n > 0) getString(R.string.mine_playlist_track_count, n) else "",
            trackCount = n,
            sourceType = type,
        )
    }

    private fun openPlaylist(item: HomeRecommendPlaylist) {
        when (item.sourceType) {
            CollectedPlaylistType.KG, CollectedPlaylistType.IMPORT_KG -> {
                PlaylistDetailActivity.start(
                    context = this,
                    playlistId = item.id,
                    title = item.name,
                    coverUrl = item.coverUrl,
                    playCountLabel = item.playCountLabel,
                    trackCount = item.trackCount,
                )
            }
            CollectedPlaylistType.WY, CollectedPlaylistType.IMPORT_WY -> {
                WyPlaylistDetailActivity.start(
                    context = this,
                    playlistId = item.id,
                    title = item.name,
                    coverUrl = item.coverUrl,
                    playCountLabel = item.playCountLabel,
                    trackCount = item.trackCount,
                    storageType = item.sourceType,
                )
            }
            CollectedPlaylistType.LOCAL -> Unit
        }
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
            context.startActivity(Intent(context, FavoritePlaylistsSearchActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
