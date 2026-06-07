package cn.partialy.pm.activity.home

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.viewModels
import androidx.core.view.isVisible
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.AppActivityTransitions
import cn.partialy.pm.activity.FeedbackActivity
import cn.partialy.pm.activity.PlaylistDetailActivity
import cn.partialy.pm.activity.SearchActivity
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityHomePlaylistListBinding
import cn.partialy.pm.ui.home.adapters.HomePlaylistGridAdapter
import cn.partialy.pm.ui.home.viewModels.HomePlaylistListViewModel
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.web.LocalGenericErrorWebViewController
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@AndroidEntryPoint
class HomePlaylistListActivity : BaseActivity() {

    private lateinit var binding: ActivityHomePlaylistListBinding
    private val viewModel: HomePlaylistListViewModel by viewModels()
    private lateinit var adapter: HomePlaylistGridAdapter
    private lateinit var errorWebView: WebView
    private var categoryId: Int = 0
    private var categoryName: String = ""
    private var errorWebController: LocalGenericErrorWebViewController? = null
    private var loadingState = false
    private var loadFailedState = false

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityHomePlaylistListBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        categoryId = intent.getIntExtra(EXTRA_CATEGORY_ID, 0)
        categoryName = intent.getStringExtra(EXTRA_CATEGORY_NAME).orEmpty().ifBlank { "歌单" }
        val errorWebViewId = resources.getIdentifier("errorWebView", "id", packageName)
        errorWebView = findViewById(errorWebViewId)

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)
        setupInsets()
        setupHeader()
        setupList()
        setupErrorView()
        observe()
        viewModel.init(categoryId)
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
        binding.titleTextView.text = categoryName
        binding.backButton.setOnClickListener { finish() }
        binding.searchButton.setOnClickListener { SearchActivity.start(this) }
        binding.swipeRefreshLayout.setOnRefreshListener { viewModel.refresh() }
    }

    private fun setupList() {
        adapter = HomePlaylistGridAdapter { item ->
            PlaylistDetailActivity.start(
                context = this,
                playlistId = item.id,
                title = item.name,
                coverUrl = item.coverUrl,
                playCountLabel = item.playCountLabel,
            )
        }
        binding.playlistRecyclerView.apply {
            layoutManager = GridLayoutManager(this@HomePlaylistListActivity, 3)
            adapter = this@HomePlaylistListActivity.adapter
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    val lm = recyclerView.layoutManager as? GridLayoutManager ?: return
                    val total = lm.itemCount
                    val last = lm.findLastVisibleItemPosition()
                    if (last >= total - 6) viewModel.loadMore()
                    binding.backToTopFab.isVisible = lm.findFirstVisibleItemPosition() > 8
                }
            })
        }
        binding.backToTopFab.setOnClickListener {
            binding.playlistRecyclerView.smoothScrollToPosition(0)
        }
    }

    private fun setupErrorView() {
        errorWebController = LocalGenericErrorWebViewController(
            webView = errorWebView,
            onRetry = { viewModel.refresh() },
            onFeedback = { FeedbackActivity.start(this) },
        ).also { it.attach() }
    }

    private fun observe() {
        lifecycleScope.launch {
            viewModel.playlists.collectLatest {
                adapter.submitList(it)
                renderState()
            }
        }
        lifecycleScope.launch {
            viewModel.isLoading.collectLatest { loading ->
                loadingState = loading
                binding.progressBar.isVisible = loading
                renderState()
            }
        }
        lifecycleScope.launch {
            viewModel.isRefreshing.collectLatest { refreshing ->
                binding.swipeRefreshLayout.isRefreshing = refreshing
                if (refreshing) binding.playlistRecyclerView.scrollToPosition(0)
            }
        }
        lifecycleScope.launch {
            viewModel.isLoadingMore.collectLatest { loadingMore ->
                binding.loadMoreProgressBar.isVisible = loadingMore
            }
        }
        lifecycleScope.launch {
            viewModel.loadFailed.collectLatest { failed ->
                loadFailedState = failed
                renderState()
            }
        }
    }

    private fun renderState() {
        val fatalError = !loadingState && loadFailedState && adapter.currentList.isEmpty()
        binding.emptyView.isVisible = fatalError
        errorWebView.isVisible = fatalError
        binding.swipeRefreshLayout.isVisible = !fatalError
        if (loadingState || fatalError) {
            errorWebController?.resetRetryUi()
        }
    }

    override fun onDestroy() {
        errorWebController?.detach()
        errorWebController = null
        errorWebView.stopLoading()
        errorWebView.loadUrl("about:blank")
        errorWebView.removeAllViews()
        errorWebView.destroy()
        super.onDestroy()
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }

    private fun dp(v: Int): Int = (resources.displayMetrics.density * v).toInt()

    companion object {
        private const val EXTRA_CATEGORY_ID = "category_id"
        private const val EXTRA_CATEGORY_NAME = "category_name"

        fun start(context: Context, categoryId: Int, categoryName: String) {
            val intent = Intent(context, HomePlaylistListActivity::class.java).apply {
                putExtra(EXTRA_CATEGORY_ID, categoryId)
                putExtra(EXTRA_CATEGORY_NAME, categoryName)
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
