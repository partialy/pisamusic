package cn.partialy.pm.ui.playlistdetail

import android.app.Activity
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.InputMethodManager
import androidx.core.content.getSystemService
import androidx.core.view.isVisible
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding

class PlaylistDetailInteractionController private constructor(
    private val activity: Activity,
    private val binding: ActivityPlaylistDetailBinding,
    private val headerAdapter: PlaylistDetailHeaderAdapter,
    private val contentAdapter: PlaylistDetailContentAdapter,
    private val onPlayAll: () -> Unit,
) {
    private var currentQuery: String = headerAdapter.state.searchQuery

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
            openSearch()
        }
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
        binding.stickyPlayAllBar.stickyPlayAllRow.setOnClickListener(null)
        binding.stickyPlayAllBar.stickyPlayAllActionContainer.setOnClickListener(null)
        binding.stickyPlayAllBar.searchPlaylistStickyButton.setOnClickListener(null)
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
        binding.stickyPlayAllBar.searchPlaylistStickyButton.isVisible = state.searchEnabled
        binding.stickyPlayAllBar.root.post(::updateStickyPosition)
    }

    /** 唯一工具条覆盖 Header 占位区，并在顶栏底部停止上移。 */
    private fun updateStickyPosition() {
        val sticky = binding.stickyPlayAllBar.root
        if (!sticky.isLaidOut || !binding.headerBar.isLaidOut) return

        val baseTop = sticky.top.toFloat()
        val headerHolder = binding.recyclerView.findViewHolderForAdapterPosition(0)
        val anchor = headerHolder?.itemView?.findViewById<View>(R.id.playAllAnchor)
        val anchorTop = anchor?.let(::topInRoot) ?: baseTop
        sticky.translationY = anchorTop.coerceAtLeast(baseTop) - baseTop
        sticky.alpha = 1f
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
