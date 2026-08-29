package cn.partialy.pm.ui.playlistdetail

import android.content.res.Configuration
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import androidx.core.content.ContextCompat
import androidx.core.content.getSystemService
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding
import cn.partialy.pm.ui.collapsing.CollapsingHeaderPolicy
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import com.google.android.material.appbar.AppBarLayout
import kotlinx.coroutines.launch

class PlaylistDetailInteractionController private constructor(
    private val activity: FragmentActivity,
    private val binding: ActivityPlaylistDetailBinding,
    private val headerController: PlaylistDetailHeaderController,
    private val contentAdapter: PlaylistDetailContentAdapter,
    private val onPlayAll: () -> Unit,
    private val onToggleCollect: () -> Unit,
    private val onSearchRequested: (() -> Unit)? = null,
) {
    private var currentQuery: String = headerController.state.searchQuery
    private val insetsController = WindowInsetsControllerCompat(activity.window, binding.root)
    private val isDarkMode =
        (activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    private val triggerPx =
        (200f * activity.resources.displayMetrics.density).toInt().coerceAtLeast(1)
    private val surfaceIconColor = ContextCompat.getColor(activity, R.color.colorOnBgNormal)
    private val expandedIconColor = ContextCompat.getColor(activity, android.R.color.white)
    private val appBarOffsetListener = AppBarLayout.OnOffsetChangedListener { _, verticalOffset ->
        applyChromeState(verticalOffset)
    }

    private val headerGestureDetector = GestureDetector(
        activity,
        object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(event: MotionEvent): Boolean = true

            override fun onSingleTapConfirmed(event: MotionEvent): Boolean = true

            override fun onDoubleTap(event: MotionEvent): Boolean {
                scrollToTop()
                return true
            }
        },
    )

    init {
        headerController.setActions(
            PlaylistDetailHeaderActions(
                onPlayAll = onPlayAll,
                onToggleCollect = onToggleCollect,
                onSearchQueryChanged = { query ->
                    currentQuery = query
                    headerController.rememberSearchQuery(query)
                    contentAdapter.setSearchQuery(query)
                },
                onSearchCancelled = { closeSearchIfOpen() },
            ),
        )
        headerController.onStateChanged = ::syncHeaderState
        syncHeaderState(headerController.state)

        binding.headerBar.setOnClickListener { }
        binding.headerBarContent.setOnTouchListener { _, event ->
            headerGestureDetector.onTouchEvent(event)
            true
        }
        binding.searchButton.setOnClickListener {
            onSearchRequested?.invoke() ?: openSearch()
        }
        binding.stickyPlayAllBar.stickyPlayAllRow.setOnClickListener { }
        binding.stickyPlayAllBar.btnPlayAllSticky.setColorFilter(
            ContextCompat.getColor(activity, R.color.primary),
        )
        binding.stickyPlayAllBar.btnPlayAllSticky.setOnClickListener { onPlayAll() }
        binding.stickyPlayAllBar.sortPlaylistButton.setOnClickListener { showSortOptionsDialog() }
        binding.stickyPlayAllBar.root.isVisible = true
        setupInsets()
        applyChromeState(verticalOffset = 0)
        binding.playlistAppBar.addOnOffsetChangedListener(appBarOffsetListener)
    }

    fun closeSearchIfOpen(): Boolean {
        if (!headerController.state.searchExpanded) return false
        currentQuery = ""
        contentAdapter.setSearchQuery("")
        headerController.setSearchState(expanded = false, query = "")
        activity.currentFocus?.let { focused ->
            focused.clearFocus()
            activity.getSystemService<InputMethodManager>()
                ?.hideSoftInputFromWindow(focused.windowToken, 0)
        }
        return true
    }

    fun dispose() {
        binding.playlistAppBar.removeOnOffsetChangedListener(appBarOffsetListener)
        headerController.onStateChanged = null
        headerController.setActions(PlaylistDetailHeaderActions())
        ViewCompat.setOnApplyWindowInsetsListener(binding.headerBar, null)
        binding.headerBar.setOnClickListener(null)
        binding.headerBarContent.setOnTouchListener(null)
        binding.searchButton.setOnClickListener(null)
        binding.stickyPlayAllBar.stickyPlayAllRow.setOnClickListener(null)
        binding.stickyPlayAllBar.btnPlayAllSticky.setOnClickListener(null)
        binding.stickyPlayAllBar.sortPlaylistButton.setOnClickListener(null)
    }

    private fun openSearch() {
        scrollToTop()
        headerController.setSearchState(
            expanded = true,
            query = currentQuery,
            requestFocus = true,
        )
    }

    private fun scrollToTop() {
        binding.playlistAppBar.setExpanded(true, true)
        (binding.recyclerView.layoutManager as? LinearLayoutManager)
            ?.scrollToPositionWithOffset(0, 0)
    }

    private fun syncHeaderState(state: PlaylistDetailHeaderState) {
        binding.playlistTitleHeaderTextView.text = state.title
        binding.stickyPlayAllBar.trackCountTextViewSticky.text = state.trackCountText
        binding.searchButton.isVisible = state.searchEnabled || onSearchRequested != null
    }

    private fun setupInsets() {
        val baseHeaderHeightPx = activity.resources.getDimensionPixelSize(
            R.dimen.playlist_detail_header_bar_height,
        )
        ViewCompat.setOnApplyWindowInsetsListener(binding.headerBar) { _, insets ->
            val statusBarTopPx = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            val metrics = CollapsingHeaderPolicy.resolveLayout(
                baseHeaderHeightPx = baseHeaderHeightPx,
                statusBarTopPx = statusBarTopPx,
            )
            binding.headerBar.updateLayoutParams<ViewGroup.LayoutParams> {
                height = metrics.overlayHeightPx
            }
            binding.headerBarContent.updatePadding(top = metrics.contentPaddingTopPx)
            binding.playlistCollapsingHeader.minimumHeight = metrics.collapsingMinimumHeightPx
            insets
        }
        ViewCompat.requestApplyInsets(binding.headerBar)
    }

    private fun applyChromeState(verticalOffset: Int) {
        val chrome = CollapsingHeaderPolicy.resolveChrome(
            verticalOffset = verticalOffset,
            triggerPx = triggerPx,
        )
        binding.headerBg.alpha = chrome.progress
        binding.playlistTitleHeaderTextView.isVisible = chrome.showTitle

        val iconColor = if (chrome.useSurfaceIcons) surfaceIconColor else expandedIconColor
        binding.backButton.setColorFilter(iconColor)
        binding.searchButton.setColorFilter(iconColor)
        binding.shareButton.setColorFilter(iconColor)
        binding.moreButton.setColorFilter(iconColor)
        insetsController.isAppearanceLightStatusBars = !isDarkMode && chrome.useSurfaceIcons
    }

    private fun showSortOptionsDialog() {
        val currentOrder = contentAdapter.sortOrder
        val selectedIndex = when (currentOrder) {
            PlaylistSortOrder.DEFAULT -> 0
            PlaylistSortOrder.TITLE_ASC -> 1
            PlaylistSortOrder.ARTIST_ASC -> 2
        }
        val options = listOf(
            SettingsOption(
                id = PlaylistSortOrder.DEFAULT.name,
                label = activity.getString(R.string.playlist_sort_default),
            ),
            SettingsOption(
                id = PlaylistSortOrder.TITLE_ASC.name,
                label = activity.getString(R.string.playlist_sort_title_asc),
            ),
            SettingsOption(
                id = PlaylistSortOrder.ARTIST_ASC.name,
                label = activity.getString(R.string.playlist_sort_artist_asc),
            ),
        )
        activity.lifecycleScope.launch {
            val selected = showSettingsOptionPicker(
                context = activity,
                title = activity.getString(R.string.playlist_sort_title),
                options = options,
                selectedIndex = selectedIndex,
            ) ?: return@launch
            val newOrder = when (selected.id) {
                PlaylistSortOrder.TITLE_ASC.name -> PlaylistSortOrder.TITLE_ASC
                PlaylistSortOrder.ARTIST_ASC.name -> PlaylistSortOrder.ARTIST_ASC
                else -> PlaylistSortOrder.DEFAULT
            }
            contentAdapter.setSortOrder(newOrder)
        }
    }

    companion object {
        fun attach(
            activity: FragmentActivity,
            binding: ActivityPlaylistDetailBinding,
            headerController: PlaylistDetailHeaderController,
            contentAdapter: PlaylistDetailContentAdapter,
            onPlayAll: () -> Unit,
            onToggleCollect: () -> Unit,
            onSearchRequested: (() -> Unit)? = null,
        ): PlaylistDetailInteractionController = PlaylistDetailInteractionController(
            activity = activity,
            binding = binding,
            headerController = headerController,
            contentAdapter = contentAdapter,
            onPlayAll = onPlayAll,
            onToggleCollect = onToggleCollect,
            onSearchRequested = onSearchRequested,
        )
    }
}
