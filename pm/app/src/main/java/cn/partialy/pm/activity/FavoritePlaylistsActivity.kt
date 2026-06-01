package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.core.view.isVisible
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityHomePlaylistListBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.HomeRecommendPlaylist
import cn.partialy.pm.ui.home.adapters.HomePlaylistGridAdapter
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class FavoritePlaylistsActivity : BaseActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityHomePlaylistListBinding
    private lateinit var adapter: HomePlaylistGridAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityHomePlaylistListBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)
        setupInsets()
        setupHeader()
        setupList()
        observeFavorites()
        playlistCollectionManager.preloadIndexFromDiskAsync()
    }

    private fun setupInsets() {
        binding.root.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.updateLayoutParams { height = insets.top }
            binding.playlistRecyclerView.updatePadding(bottom = insets.bottom + dp(20))
            binding.backToTopFab.updateLayoutParams<androidx.constraintlayout.widget.ConstraintLayout.LayoutParams> {
                bottomMargin = insets.bottom + dp(20)
            }
        }
    }

    private fun setupHeader() {
        binding.titleTextView.setText(R.string.my_favorite_playlists)
        binding.backButton.setOnClickListener { finish() }
        binding.searchButton.isVisible = false
        binding.swipeRefreshLayout.isEnabled = false
        binding.progressBar.isVisible = false
        binding.loadMoreProgressBar.isVisible = false
        binding.errorWebView.isVisible = false
    }

    private fun setupList() {
        adapter = HomePlaylistGridAdapter { item -> openPlaylist(item) }
        binding.playlistRecyclerView.apply {
            layoutManager = GridLayoutManager(this@FavoritePlaylistsActivity, 3)
            adapter = this@FavoritePlaylistsActivity.adapter
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    val lm = recyclerView.layoutManager as? GridLayoutManager ?: return
                    binding.backToTopFab.isVisible = lm.findFirstVisibleItemPosition() > 8
                }
            })
        }
        binding.backToTopFab.setOnClickListener {
            binding.playlistRecyclerView.smoothScrollToPosition(0)
        }
    }

    private fun observeFavorites() {
        lifecycleScope.launch {
            playlistCollectionManager.playlistsFlow.collectLatest { list ->
                val items = list
                    .filter { it.type != CollectedPlaylistType.LOCAL }
                    .map { it.toHomePlaylist() }
                adapter.submitList(items)
                binding.emptyView.isVisible = items.isEmpty()
            }
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

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }

    private fun dp(v: Int): Int = (resources.displayMetrics.density * v).toInt()

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, FavoritePlaylistsActivity::class.java)
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
