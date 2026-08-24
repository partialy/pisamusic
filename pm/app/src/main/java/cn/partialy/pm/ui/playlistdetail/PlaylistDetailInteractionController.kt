package cn.partialy.pm.ui.playlistdetail

import android.app.Activity
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.inputmethod.InputMethodManager
import androidx.core.content.getSystemService
import androidx.core.view.isVisible
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding

class PlaylistDetailInteractionController private constructor(
    private val activity: Activity,
    private val binding: ActivityPlaylistDetailBinding,
    private val headerAdapter: PlaylistDetailHeaderAdapter,
    private val contentAdapter: PlaylistDetailContentAdapter,
    private val onPlayAll: () -> Unit,
) {
    private var currentQuery: String = headerAdapter.state.searchQuery

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
                onSearchRequested = { openSearch(fromSticky = false) },
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
        binding.stickyPlayAllBar.stickyPlayAllRow.setOnClickListener { }
        binding.stickyPlayAllBar.stickyPlayAllActionContainer.setOnClickListener { onPlayAll() }
        binding.stickyPlayAllBar.searchPlaylistStickyButton.setOnClickListener {
            openSearch(fromSticky = true)
        }
    }

    fun setStickyVisible(visible: Boolean) {
        binding.stickyPlayAllBar.root.isVisible = visible
        headerAdapter.setInlinePlayAllVisible(!visible)
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
        binding.stickyPlayAllBar.stickyPlayAllRow.setOnClickListener(null)
        binding.stickyPlayAllBar.stickyPlayAllActionContainer.setOnClickListener(null)
        binding.stickyPlayAllBar.searchPlaylistStickyButton.setOnClickListener(null)
    }

    private fun openSearch(fromSticky: Boolean) {
        if (fromSticky) scrollToTop()
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
    }

    companion object {
        fun attach(
            activity: Activity,
            binding: ActivityPlaylistDetailBinding,
            headerAdapter: PlaylistDetailHeaderAdapter,
            contentAdapter: PlaylistDetailContentAdapter,
            onPlayAll: () -> Unit,
        ): PlaylistDetailInteractionController = PlaylistDetailInteractionController(
            activity = activity,
            binding = binding,
            headerAdapter = headerAdapter,
            contentAdapter = contentAdapter,
            onPlayAll = onPlayAll,
        )
    }
}
