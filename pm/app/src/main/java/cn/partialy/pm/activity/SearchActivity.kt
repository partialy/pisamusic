package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Toast
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import androidx.activity.viewModels
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.content.ContextCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivitySearchBinding
import cn.partialy.pm.model.SearchSongInfo
import cn.partialy.pm.model.SearchTrackRow
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.search.SearchViewModel
import cn.partialy.pm.ui.search.adapter.SearchPlaylistAdapter
import cn.partialy.pm.ui.search.adapter.SearchRecommendAdapter
import cn.partialy.pm.ui.search.adapter.SearchResultsAdapter
import cn.partialy.pm.ui.search.adapter.SuggestionsAdapter
import cn.partialy.pm.ui.web.LocalGenericErrorWebViewController
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.chip.Chip
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

@AndroidEntryPoint
class SearchActivity : BaseDownloadActivity() {
    private lateinit var binding: ActivitySearchBinding
    private val viewModel: SearchViewModel by viewModels()

    @Inject
    lateinit var love: LoveManager

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var searchResultsAdapter: SearchResultsAdapter
    private lateinit var suggestionsAdapter: SuggestionsAdapter
    private lateinit var searchRecommendAdapter: SearchRecommendAdapter
    private lateinit var searchPlaylistAdapter: SearchPlaylistAdapter
    private var homeMiniPlayerBinder: HomeMiniPlayerBinder? = null
    private var sourcePopup: PopupWindow? = null
    private var errorWebController: LocalGenericErrorWebViewController? = null
    private var searchScreenMode: SearchScreenMode = SearchScreenMode.INITIAL

    /** 0 单曲，1 歌单 */
    private var searchResultCategory: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivitySearchBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)
        applySearchInsets()

        setupHeader()
        setupSearchResultTabs()
        setupSourcePicker()
        setupRecyclerViews()
        setupErrorView()
        setupSearchEditText()
        observeViewModel()

        viewModel.loadHotSearchKeywords()
        setupSearchHistory()
        viewModel.loadSearchHistory()
        loveManager = love

        homeMiniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@SearchActivity)
        }
    }

    private fun setupErrorView() {
        errorWebController = LocalGenericErrorWebViewController(
            binding.searchErrorWebView,
            onRetry = { retryCurrentSearch() },
            onFeedback = { FeedbackWebActivity.start(this) },
        ).also { it.attach() }
    }

    private fun applySearchInsets() {
        val miniBottomBase = resources.getDimensionPixelSize(R.dimen.home_mini_player_bottom_margin)
        val overlapPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_overlap)
        val miniHeightPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_height)
        binding.searchRoot.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            val lp = binding.homeMiniPlayer.root.layoutParams as ConstraintLayout.LayoutParams
            // CardView uses translationY = overlap: layout must sit higher by the same amount
            // or the drawn bar extends past the window bottom.
            lp.bottomMargin = miniBottomBase + overlapPx + insets.bottom
            binding.homeMiniPlayer.root.layoutParams = lp

            // Top of visually shifted card is (parentBottom - bottomMargin - height + overlap).
            // With margin = base+overlap+inset, clearance from bottom = height + base + inset.
            val listPadBottom = miniHeightPx + miniBottomBase + insets.bottom
            binding.searchContentScrollView.updatePadding(bottom = listPadBottom)
            binding.suggestionsRecyclerView.updatePadding(bottom = listPadBottom)
            binding.searchResultsRecyclerView.updatePadding(bottom = listPadBottom)
            binding.searchPlaylistRecyclerView.updatePadding(bottom = listPadBottom)
        }
    }

    private fun setupHeader() {
        binding.searchBackButton.setOnClickListener { finish() }
        binding.searchSubmitTextView.setOnClickListener {
            val keyword = binding.searchEditText.text.toString().trim()
            if (keyword.isEmpty()) {
                Toast.makeText(this, R.string.search_empty_keyword, Toast.LENGTH_SHORT).show()
            } else {
                performSearch(keyword)
            }
        }
        binding.clearHistoryButton.setOnClickListener {
            MaterialAlertDialogBuilder(this)
                .setTitle(R.string.clear_search_history)
                .setMessage(R.string.clear_search_history_confirm)
                .setPositiveButton(R.string.dialog_ok) { _, _ ->
                    viewModel.clearSearchHistory()
                }
                .setNegativeButton(R.string.cancel, null)
                .show()
        }
        binding.refreshRecommendButton.setOnClickListener {
            viewModel.loadHotSearchKeywords()
        }
    }

    private fun setupSearchResultTabs() {
        binding.tabSearchSongContainer.setOnClickListener {
            selectSearchResultCategory(0)
        }
        binding.tabSearchPlaylistContainer.setOnClickListener {
            selectSearchResultCategory(1)
            val kw = viewModel.currentSearchKeyword().ifBlank {
                binding.searchEditText.text.toString().trim()
            }
            viewModel.searchPlaylist(kw, isNewSearch = true)
        }
    }

    private fun setupSourcePicker() {
        binding.searchSourceCard.setOnClickListener {
            showSourceDropdown()
        }
    }

    private fun showSourceDropdown() {
        sourcePopup?.dismiss()
        val content = LayoutInflater.from(this).inflate(R.layout.layout_search_source_dropdown, null, false)
        val container = content.findViewById<LinearLayout>(R.id.searchSourceOptionsContainer)
        val options = listOf(
            SongType.KG to getString(R.string.search_source_kg),
            SongType.WY to getString(R.string.search_source_wy),
            SongType.KW to getString(R.string.search_source_kw),
        )
        val current = viewModel.searchSource.value ?: SongType.KG
        options.forEach { (type, label) ->
            val row = LayoutInflater.from(this).inflate(R.layout.item_search_source_option, container, false) as TextView
            row.text = if (type == current) "✓  $label" else label
            row.setOnClickListener {
                sourcePopup?.dismiss()
                viewModel.setSearchSource(type)
            }
            container.addView(row)
        }

        val width = binding.searchSourceCard.width.coerceAtLeast((resources.displayMetrics.density * 96).toInt())
        sourcePopup = PopupWindow(
            content,
            width,
            RecyclerView.LayoutParams.WRAP_CONTENT,
            true,
        ).apply {
            isOutsideTouchable = true
            elevation = resources.displayMetrics.density * 8f
        }
        sourcePopup?.showAsDropDown(binding.searchSourceCard, 0, (resources.displayMetrics.density * 6).toInt(), Gravity.END)
    }

    private fun setupRecyclerViews() {
        searchResultsAdapter = SearchResultsAdapter(
            onItemClick = { row ->
                addToListAndPlay(row)
                Toast.makeText(this, "开始播放：${row.title}", Toast.LENGTH_SHORT).show()
            },
            onDownloadClick = { row ->
                onDownloadClick(row.toSongInfo())
            },
            onMoreClick = { row ->
                SongMoreMenu.show(
                    this,
                    row.toSongInfo(),
                    SongMoreMenuDependencies(
                        musicController = musicController,
                        loveManager = love,
                        playlistCollectionManager = playlistCollectionManager,
                        onDownloadClick = { startSongDownloadFlow(it) },
                    ),
                )
            },
        )

        binding.searchResultsRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@SearchActivity)
            adapter = searchResultsAdapter
        }
        binding.searchResultsRecyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                super.onScrolled(recyclerView, dx, dy)
                if (searchResultCategory != 0) return

                val layoutManager = recyclerView.layoutManager as LinearLayoutManager
                val visibleItemCount = layoutManager.childCount
                val totalItemCount = layoutManager.itemCount
                val firstVisibleItemPosition = layoutManager.findFirstVisibleItemPosition()

                if (!viewModel.isLoading.value!! &&
                    (visibleItemCount + firstVisibleItemPosition) >= totalItemCount &&
                    firstVisibleItemPosition >= 0
                ) {
                    viewModel.loadMoreResults()
                }
            }
        })

        searchPlaylistAdapter = SearchPlaylistAdapter { item ->
            when (item.source) {
                SongType.KG -> {
                    PlaylistDetailActivity.start(
                        context = this,
                        playlistId = item.id,
                        title = item.name,
                        coverUrl = item.coverUrl,
                        playCountLabel = buildPlaylistPlayCountLabel(item.playCount),
                    )
                }
                SongType.WY -> {
                    WyPlaylistDetailActivity.start(
                        context = this,
                        playlistId = item.id,
                        title = item.name,
                        coverUrl = item.coverUrl,
                        playCountLabel = buildPlaylistPlayCountLabel(item.playCount),
                        trackCount = item.songCount,
                        storageType = CollectedPlaylistType.WY,
                    )
                }
                else -> {
                    Toast.makeText(this, R.string.search_playlist_unsupported_other_source, Toast.LENGTH_SHORT).show()
                }
            }
        }
        binding.searchPlaylistRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@SearchActivity)
            adapter = searchPlaylistAdapter
        }
        binding.searchPlaylistRecyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                super.onScrolled(recyclerView, dx, dy)
                if (searchResultCategory != 1) return

                val layoutManager = recyclerView.layoutManager as LinearLayoutManager
                val visibleItemCount = layoutManager.childCount
                val totalItemCount = layoutManager.itemCount
                val firstVisibleItemPosition = layoutManager.findFirstVisibleItemPosition()

                if ((visibleItemCount + firstVisibleItemPosition) >= totalItemCount &&
                    firstVisibleItemPosition >= 0
                ) {
                    viewModel.loadMorePlaylistResults()
                }
            }
        })

        suggestionsAdapter = SuggestionsAdapter { suggestion ->
            binding.searchEditText.setText(suggestion)
            performSearch(suggestion)
        }
        binding.suggestionsRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@SearchActivity)
            adapter = suggestionsAdapter
        }

        searchRecommendAdapter = SearchRecommendAdapter { keyword ->
            binding.searchEditText.setText(keyword)
            performSearch(keyword)
        }
        binding.hotSearchRecyclerView.apply {
            layoutManager = GridLayoutManager(this@SearchActivity, 2)
            adapter = searchRecommendAdapter
        }
    }

    private fun setupSearchEditText() {
        binding.searchEditText.apply {
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                    val keyword = text.toString().trim()
                    if (keyword.isEmpty()) {
                        Toast.makeText(this@SearchActivity, R.string.search_empty_keyword, Toast.LENGTH_SHORT).show()
                    } else {
                        performSearch(keyword)
                    }
                    true
                } else {
                    false
                }
            }

            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
                override fun afterTextChanged(s: Editable?) {
                    val keyword = s?.toString() ?: ""
                    if (keyword.isNotEmpty()) {
                        viewModel.getSuggestions(keyword)
                        showSuggestions()
                    } else {
                        showInitialContent()
                    }
                }
            })
        }
    }

    private fun observeViewModel() {
        viewModel.searchResults.observe(this) { results ->
            searchResultsAdapter.submitList(results) {
                renderSearchScreen()
            }
        }

        viewModel.suggestions.observe(this) { suggestions ->
            suggestionsAdapter.submitList(suggestions)
        }

        viewModel.hotSearchKeywords.observe(this) { hotList ->
            searchRecommendAdapter.submitList(SearchRecommendAdapter.flattenKeywords(hotList))
        }

        viewModel.searchPlaylistResults.observe(this) { list ->
            searchPlaylistAdapter.submitList(list) {
                renderSearchScreen()
            }
        }

        viewModel.searchSource.observe(this) { src ->
            binding.searchSourceLabel.setText(
                when (src) {
                    SongType.KG -> R.string.search_source_kg
                    SongType.WY -> R.string.search_source_wy
                    SongType.KW -> R.string.search_source_kw
                    else -> R.string.search_source_kg
                },
            )
            if (searchResultCategory == 1) {
                val kw = viewModel.currentSearchKeyword().ifBlank {
                    binding.searchEditText.text.toString().trim()
                }
                viewModel.searchPlaylist(kw, isNewSearch = true)
            }
            renderSearchScreen()
        }

        viewModel.isLoading.observe(this) {
            renderSearchScreen()
        }

        viewModel.isLoadingMore.observe(this) {
            renderSearchScreen()
        }

        viewModel.searchFailed.observe(this) {
            renderSearchScreen()
        }

        viewModel.isPlaylistLoading.observe(this) {
            renderSearchScreen()
        }

        viewModel.isPlaylistLoadingMore.observe(this) {
            renderSearchScreen()
        }

        viewModel.playlistSearchFailed.observe(this) {
            renderSearchScreen()
        }
    }

    private fun updateSearchResultTabUi(selectedIndex: Int) {
        val selectedColor = ContextCompat.getColor(this, R.color.home_tab_selected)
        val unselectedColor = ContextCompat.getColor(this, R.color.home_tab_unselected)
        binding.tabSearchSong.setTextColor(if (selectedIndex == 0) selectedColor else unselectedColor)
        binding.tabSearchSongUnderline.visibility = if (selectedIndex == 0) View.VISIBLE else View.INVISIBLE
        binding.tabSearchSongUnderline.setBackgroundColor(selectedColor)
        binding.tabSearchPlaylist.setTextColor(if (selectedIndex == 1) selectedColor else unselectedColor)
        binding.tabSearchPlaylistUnderline.visibility = if (selectedIndex == 1) View.VISIBLE else View.INVISIBLE
        binding.tabSearchPlaylistUnderline.setBackgroundColor(selectedColor)
    }

    private fun selectSearchResultCategory(index: Int) {
        searchResultCategory = index
        updateSearchResultTabUi(index)
        renderSearchScreen()
    }

    private fun applySearchResultListVisibility() {
        renderSearchScreen()
    }

    private fun refreshPlaylistEmptyState() {
        renderSearchScreen()
    }

    private fun performSearch(keyword: String) {
        val trimmed = keyword.trim()
        if (trimmed.isEmpty()) {
            Toast.makeText(this, R.string.search_empty_keyword, Toast.LENGTH_SHORT).show()
            return
        }
        viewModel.search(trimmed)
        showSearchResults()
        hideKeyboard()
    }

    private fun addToListAndPlay(row: SearchTrackRow) {
        lifecycleScope.launch {
            val base = row.toSongInfo()
            val cover = if ("{size}" in base.coverUrl) {
                base.coverUrl.replace("{size}", "240")
            } else {
                base.coverUrl
            }
            musicController.addToPlayList(base.copy(coverUrl = cover), true)
        }
    }

    private fun setupSearchHistory() {
        viewModel.searchHistory.observe(this) { historyList ->
            updateSearchHistoryChips(historyList)
        }
    }

    private fun updateSearchHistoryChips(historyList: List<String>) {
        binding.recentSearchLayout.visibility = if (historyList.isEmpty()) View.GONE else View.VISIBLE
        binding.clearHistoryButton.visibility = if (historyList.isEmpty()) View.GONE else View.VISIBLE
        binding.recentSearchChipGroup.removeAllViews()

        val chipBg = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.search_history_chip_bg))
        val chipStroke = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.search_history_chip_stroke))
        val strokePx = resources.getDimensionPixelSize(R.dimen.search_history_chip_stroke_width)

        historyList.forEach { keyword ->
            val chip = Chip(this).apply {
                text = keyword
                isCloseIconVisible = true
                chipBackgroundColor = chipBg
                chipStrokeColor = chipStroke
                chipStrokeWidth = strokePx.toFloat()
                closeIconTint = ColorStateList.valueOf(ContextCompat.getColor(this@SearchActivity, R.color.home_tab_unselected))
                setOnClickListener {
                    binding.searchEditText.setText(keyword)
                    viewModel.search(keyword)
                    showSearchResults()
                    hideKeyboard()
                }
                setOnCloseIconClickListener {
                    viewModel.deleteHistoryItem(keyword)
                }
            }
            binding.recentSearchChipGroup.addView(chip)
        }
    }

    private fun showInitialContent() {
        searchScreenMode = SearchScreenMode.INITIAL
        renderSearchScreen()
    }

    private fun showSuggestions() {
        searchScreenMode = SearchScreenMode.SUGGESTIONS
        renderSearchScreen()
    }

    private fun showSearchResults() {
        searchScreenMode = SearchScreenMode.RESULTS
        selectSearchResultCategory(0)
    }

    private fun renderSearchScreen() {
        if (!::searchResultsAdapter.isInitialized || !::searchPlaylistAdapter.isInitialized) return

        val inResults = searchScreenMode == SearchScreenMode.RESULTS
        val isPlaylist = searchResultCategory == 1
        val initialLoading = inResults && if (isPlaylist) {
            viewModel.isPlaylistLoading.value == true
        } else {
            viewModel.isLoading.value == true
        }
        val fatalError = inResults && !initialLoading && if (isPlaylist) {
            viewModel.playlistSearchFailed.value == true && searchPlaylistAdapter.currentList.isEmpty()
        } else {
            viewModel.searchFailed.value == true && searchResultsAdapter.currentList.isEmpty()
        }
        val playlistEmpty = inResults &&
            isPlaylist &&
            !initialLoading &&
            !fatalError &&
            searchPlaylistAdapter.currentList.isEmpty()

        binding.searchContentScrollView.visibility =
            if (searchScreenMode == SearchScreenMode.INITIAL) View.VISIBLE else View.GONE
        binding.suggestionsRecyclerView.visibility =
            if (searchScreenMode == SearchScreenMode.SUGGESTIONS) View.VISIBLE else View.GONE
        binding.searchResultsTabBar.visibility = if (inResults) View.VISIBLE else View.GONE
        binding.searchResultsRecyclerView.visibility =
            if (inResults && !isPlaylist && !initialLoading && !fatalError) View.VISIBLE else View.GONE
        binding.searchPlaylistRecyclerView.visibility =
            if (inResults && isPlaylist && !initialLoading && !fatalError && !playlistEmpty) View.VISIBLE else View.GONE
        binding.searchPlaylistEmptyView.visibility = if (playlistEmpty) View.VISIBLE else View.GONE
        binding.searchInitialProgressBar.visibility = if (initialLoading) View.VISIBLE else View.GONE
        binding.searchErrorWebView.visibility = if (fatalError) View.VISIBLE else View.GONE
        binding.loadMoreProgressBar.visibility = if (shouldShowLoadMoreProgress(inResults)) View.VISIBLE else View.GONE

        if (playlistEmpty) {
            val unsupported = viewModel.searchSource.value == SongType.KW
            binding.searchPlaylistEmptyView.setText(
                if (unsupported) R.string.search_playlist_unsupported_other_source
                else R.string.search_playlist_empty,
            )
        }

        if (initialLoading || fatalError) {
            errorWebController?.resetRetryUi()
        }
    }

    private fun shouldShowLoadMoreProgress(inResults: Boolean): Boolean {
        if (!inResults) return false
        return when (searchResultCategory) {
            0 -> viewModel.isLoadingMore.value == true
            else -> viewModel.isPlaylistLoadingMore.value == true
        }
    }

    private fun retryCurrentSearch() {
        val keyword = viewModel.currentSearchKeyword().ifBlank {
            binding.searchEditText.text.toString().trim()
        }
        if (keyword.isBlank()) {
            Toast.makeText(this, R.string.search_empty_keyword, Toast.LENGTH_SHORT).show()
            errorWebController?.resetRetryUi()
            return
        }
        searchScreenMode = SearchScreenMode.RESULTS
        if (searchResultCategory == 1) {
            viewModel.searchPlaylist(keyword, isNewSearch = true)
        } else {
            viewModel.search(keyword, isNewSearch = true, recordHistory = false)
        }
        renderSearchScreen()
    }

    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(binding.searchEditText.windowToken, 0)
    }

    private fun buildPlaylistPlayCountLabel(playCount: Long): String {
        if (playCount <= 0L) return "—"
        val num = when {
            playCount >= 100_000_000L -> String.format(Locale.CHINA, "%.1f亿", playCount / 100_000_000.0)
            playCount >= 10_000L -> String.format(Locale.CHINA, "%.1f万", playCount / 10_000.0)
            else -> playCount.toString()
        }
        return "${num}次播放"
    }

    override fun onDestroy() {
        errorWebController?.detach()
        errorWebController = null
        val wv = binding.searchErrorWebView
        (wv.parent as? ViewGroup)?.removeView(wv)
        wv.stopLoading()
        wv.loadUrl("about:blank")
        wv.removeAllViews()
        wv.destroy()
        homeMiniPlayerBinder?.onDestroy()
        homeMiniPlayerBinder = null
        super.onDestroy()
    }

    override fun finish() {
        super.finish()
        overridePendingTransition(R.anim.dim_and_scale_in, R.anim.slide_up_to_top)
    }

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, SearchActivity::class.java)
            context.startActivity(intent)
            (context as Activity).overridePendingTransition(
                R.anim.slide_down_from_top,
                R.anim.dim_and_scale_out,
            )
        }
    }

    private enum class SearchScreenMode {
        INITIAL,
        SUGGESTIONS,
        RESULTS,
    }
}
