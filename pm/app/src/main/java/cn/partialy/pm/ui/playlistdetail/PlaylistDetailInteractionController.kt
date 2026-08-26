package cn.partialy.pm.ui.playlistdetail

import android.animation.ArgbEvaluator
import android.content.res.Configuration
import android.graphics.Color
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.InputMethodManager
import androidx.core.content.ContextCompat
import androidx.core.content.getSystemService
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import kotlinx.coroutines.launch

class PlaylistDetailInteractionController private constructor(
    private val activity: FragmentActivity,
    private val binding: ActivityPlaylistDetailBinding,
    private val headerAdapter: PlaylistDetailHeaderAdapter,
    private val contentAdapter: PlaylistDetailContentAdapter,
    private val onPlayAll: () -> Unit,
    private val onToggleCollect: () -> Unit,
    private val onSearchRequested: (() -> Unit)? = null,
) {
    private var currentQuery: String = headerAdapter.state.searchQuery
    private val argbEvaluator = ArgbEvaluator()
    private val insetsController = WindowInsetsControllerCompat(activity.window, binding.root)
    private val isDarkMode =
        (activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    private val unselectedIconColor =
        ContextCompat.getColor(activity, R.color.home_tab_unselected)

    private val stickyScrollListener = object : RecyclerView.OnScrollListener() {
        override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
            updateStickyPosition()
        }
    }
    private val stickyLayoutListener = View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
        updateStickyPosition()
    }
    private val childAttachListener = object : RecyclerView.OnChildAttachStateChangeListener {
        override fun onChildViewAttachedToWindow(view: View) {
            binding.recyclerView.post(::updateStickyPosition)
        }

        override fun onChildViewDetachedFromWindow(view: View) {
            binding.recyclerView.post(::updateStickyPosition)
        }
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
        headerAdapter.setActions(
            PlaylistDetailHeaderActions(
                onPlayAll = onPlayAll,
                onToggleCollect = onToggleCollect,
                onSearchQueryChanged = { query ->
                    currentQuery = query
                    headerAdapter.rememberSearchQuery(query)
                    contentAdapter.setSearchQuery(query)
                },
                onSearchCancelled = { closeSearchIfOpen() },
            ),
        )
        headerAdapter.onStateChanged = ::syncHeaderState
        syncHeaderState(headerAdapter.state)

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
        binding.stickyPlayAllBar.root.alpha = 0f
        binding.recyclerView.addOnScrollListener(stickyScrollListener)
        binding.recyclerView.addOnLayoutChangeListener(stickyLayoutListener)
        binding.headerBar.addOnLayoutChangeListener(stickyLayoutListener)
        binding.recyclerView.addOnChildAttachStateChangeListener(childAttachListener)
        binding.stickyPlayAllBar.root.post(::updateStickyPosition)
    }

    fun closeSearchIfOpen(): Boolean {
        if (!headerAdapter.state.searchExpanded) return false
        currentQuery = ""
        contentAdapter.setSearchQuery("")
        headerAdapter.setSearchState(expanded = false, query = "")
        activity.currentFocus?.let { focused ->
            focused.clearFocus()
            activity.getSystemService<InputMethodManager>()
                ?.hideSoftInputFromWindow(focused.windowToken, 0)
        }
        return true
    }

    fun dispose() {
        headerAdapter.onStateChanged = null
        binding.headerBar.setOnClickListener(null)
        binding.headerBarContent.setOnTouchListener(null)
        binding.searchButton.setOnClickListener(null)
        binding.stickyPlayAllBar.stickyPlayAllRow.setOnClickListener(null)
        binding.stickyPlayAllBar.btnPlayAllSticky.setOnClickListener(null)
        binding.stickyPlayAllBar.sortPlaylistButton.setOnClickListener(null)
        binding.recyclerView.removeOnScrollListener(stickyScrollListener)
        binding.recyclerView.removeOnLayoutChangeListener(stickyLayoutListener)
        binding.headerBar.removeOnLayoutChangeListener(stickyLayoutListener)
        binding.recyclerView.removeOnChildAttachStateChangeListener(childAttachListener)
    }

    private fun openSearch() {
        scrollToTop()
        headerAdapter.setSearchState(
            expanded = true,
            query = currentQuery,
            requestFocus = true,
        )
    }

    private fun scrollToTop() {
        (binding.recyclerView.layoutManager as? LinearLayoutManager)
            ?.scrollToPositionWithOffset(0, 0)
    }

    private fun syncHeaderState(state: PlaylistDetailHeaderState) {
        binding.playlistTitleHeaderTextView.text = state.title
        binding.stickyPlayAllBar.trackCountTextViewSticky.text = state.trackCountText
        binding.searchButton.isVisible = state.searchEnabled || onSearchRequested != null
        binding.stickyPlayAllBar.root.post(::updateStickyPosition)
    }

    /** 唯一工具条覆盖 Header 占位区，并在顶栏底部停止上移。 */
    private fun updateStickyPosition() {
        val sticky = binding.stickyPlayAllBar.root
        if (!sticky.isLaidOut || !binding.headerBar.isLaidOut) return

        val stickyTop = sticky.top.toFloat()
        val headerHolder = binding.recyclerView.findViewHolderForAdapterPosition(0)
        val anchor = headerHolder?.itemView?.findViewById<View>(R.id.playAllAnchor)
        val anchorTop = anchor?.let(::topInRoot) ?: stickyTop
        sticky.translationY = anchorTop.coerceAtLeast(stickyTop) - stickyTop
        sticky.alpha = 1f

        val fadeDistance = 72f * activity.resources.displayMetrics.density
        val chromeProgress = ((stickyTop + fadeDistance - anchorTop) / fadeDistance)
            .coerceIn(0f, 1f)
        binding.headerBg.alpha = chromeProgress
        binding.playlistTitleHeaderTextView.isVisible = chromeProgress >= 0.98f

        val iconColor = argbEvaluator.evaluate(
            chromeProgress,
            Color.WHITE,
            unselectedIconColor,
        ) as Int
        binding.backButton.setColorFilter(iconColor)
        binding.searchButton.setColorFilter(iconColor)
        binding.shareButton.setColorFilter(iconColor)
        binding.moreButton.setColorFilter(iconColor)

        if (isDarkMode) {
            insetsController.isAppearanceLightStatusBars = false
        } else {
            insetsController.isAppearanceLightStatusBars = chromeProgress >= 0.55f
        }
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

    private fun topInRoot(view: View): Float {
        val rootLocation = IntArray(2)
        val viewLocation = IntArray(2)
        binding.root.getLocationInWindow(rootLocation)
        view.getLocationInWindow(viewLocation)
        return (viewLocation[1] - rootLocation[1]).toFloat()
    }

    companion object {
        fun attach(
            activity: FragmentActivity,
            binding: ActivityPlaylistDetailBinding,
            headerAdapter: PlaylistDetailHeaderAdapter,
            contentAdapter: PlaylistDetailContentAdapter,
            onPlayAll: () -> Unit,
            onToggleCollect: () -> Unit,
            onSearchRequested: (() -> Unit)? = null,
        ): PlaylistDetailInteractionController = PlaylistDetailInteractionController(
            activity = activity,
            binding = binding,
            headerAdapter = headerAdapter,
            contentAdapter = contentAdapter,
            onPlayAll = onPlayAll,
            onToggleCollect = onToggleCollect,
            onSearchRequested = onSearchRequested,
        )
    }
}
