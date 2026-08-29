package cn.partialy.pm.ui.playlistdetail

import android.text.TextWatcher
import android.view.inputmethod.InputMethodManager
import androidx.core.content.getSystemService
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemPlaylistDetailHeaderBinding
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import coil.load

sealed interface PlaylistHeaderArtwork {
    data class Remote(val url: String) : PlaylistHeaderArtwork
    data class DrawableRes(@androidx.annotation.DrawableRes val resId: Int) : PlaylistHeaderArtwork
    data class LocalPlaylist(val value: String) : PlaylistHeaderArtwork
}

data class PlaylistDetailHeaderState(
    val title: String = "",
    val description: String = "",
    val artwork: PlaylistHeaderArtwork = PlaylistHeaderArtwork.DrawableRes(R.drawable.ic_playlist_24),
    val trackCountText: String = "",
    val searchExpanded: Boolean = false,
    val searchQuery: String = "",
    val searchEnabled: Boolean = true,
    val collectionVisible: Boolean = false,
    val collectionEnabled: Boolean = false,
    val collected: Boolean = false,
)

internal data class PlaylistDetailHeaderActions(
    val onPlayAll: () -> Unit = {},
    val onToggleCollect: () -> Unit = {},
    val onSearchQueryChanged: (String) -> Unit = {},
    val onSearchCancelled: () -> Unit = {},
)

class PlaylistDetailHeaderController(
    private val binding: ItemPlaylistDetailHeaderBinding,
) {
    var state: PlaylistDetailHeaderState = PlaylistDetailHeaderState()
        private set

    internal var onStateChanged: ((PlaylistDetailHeaderState) -> Unit)? = null

    private var actions = PlaylistDetailHeaderActions()
    private var requestSearchFocusOnNextRender = false
    private var searchWatcher: TextWatcher? = null
    private var renderingSearchQuery = false
    private var disposed = false

    init {
        binding.headerPlayAllButton.setOnClickListener { actions.onPlayAll() }
        binding.headerCollectButton.setOnClickListener {
            if (state.collectionEnabled) actions.onToggleCollect()
        }
        binding.playlistSearchCancelText.setOnClickListener { actions.onSearchCancelled() }
        searchWatcher = binding.playlistSearchInput.doAfterTextChanged {
            if (!renderingSearchQuery) actions.onSearchQueryChanged(it?.toString().orEmpty())
        }
        render()
    }

    fun updateHeader(
        title: String? = null,
        description: String? = null,
        artwork: PlaylistHeaderArtwork? = null,
        trackCountText: String? = null,
    ) {
        state = state.copy(
            title = title ?: state.title,
            description = description ?: state.description,
            artwork = artwork ?: state.artwork,
            trackCountText = trackCountText ?: state.trackCountText,
        )
        notifyStateChanged()
    }

    fun updateCollectionState(visible: Boolean, enabled: Boolean, collected: Boolean) {
        state = state.copy(
            collectionVisible = visible,
            collectionEnabled = enabled,
            collected = collected,
        )
        notifyStateChanged()
    }

    fun setSearchState(expanded: Boolean, query: String, requestFocus: Boolean = false) {
        state = state.copy(searchExpanded = expanded, searchQuery = query)
        requestSearchFocusOnNextRender = requestFocus
        notifyStateChanged()
    }

    internal fun rememberSearchQuery(query: String) {
        state = state.copy(searchQuery = query)
    }

    fun setSearchEnabled(enabled: Boolean) {
        if (state.searchEnabled == enabled) return
        state = state.copy(
            searchEnabled = enabled,
            searchExpanded = state.searchExpanded && enabled,
            searchQuery = if (enabled) state.searchQuery else "",
        )
        notifyStateChanged()
    }

    internal fun setActions(actions: PlaylistDetailHeaderActions) {
        this.actions = actions
    }

    fun dispose() {
        if (disposed) return
        disposed = true
        searchWatcher?.let(binding.playlistSearchInput::removeTextChangedListener)
        searchWatcher = null
        binding.headerPlayAllButton.setOnClickListener(null)
        binding.headerCollectButton.setOnClickListener(null)
        binding.playlistSearchCancelText.setOnClickListener(null)
        actions = PlaylistDetailHeaderActions()
        onStateChanged = null
    }

    private fun notifyStateChanged() {
        render()
        onStateChanged?.invoke(state)
    }

    private fun render() {
        if (disposed) return

        binding.playlistTitleTextView.text = state.title
        binding.playlistDescTextView.text = state.description
        binding.playlistDescTextView.isVisible = state.description.isNotBlank()

        binding.headerCollectButton.isVisible = state.collectionVisible
        binding.headerCollectButton.isEnabled = state.collectionEnabled
        binding.headerCollectButton.alpha = if (state.collectionEnabled) 1f else 0.62f
        binding.headerCollectButton.text = binding.root.context.getString(
            if (state.collected) R.string.playlist_detail_collected else R.string.collect_playlist,
        )
        binding.headerCollectButton.setIconResource(
            if (state.collected) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
        )
        binding.headerCollectButton.setIconTintResource(
            if (state.collected) R.color.red else R.color.home_tab_selected,
        )

        bindArtwork(state.artwork)
        renderSearch()
    }

    private fun renderSearch() {
        if (binding.playlistSearchInput.text.toString() != state.searchQuery) {
            renderingSearchQuery = true
            try {
                binding.playlistSearchInput.setText(state.searchQuery)
                binding.playlistSearchInput.setSelection(state.searchQuery.length)
            } finally {
                renderingSearchQuery = false
            }
        }
        binding.playlistSearchBarLayout.isVisible = state.searchEnabled && state.searchExpanded

        val requestFocus = requestSearchFocusOnNextRender
        requestSearchFocusOnNextRender = false
        if (state.searchExpanded && requestFocus) {
            binding.playlistSearchInput.post {
                if (disposed || !state.searchExpanded) return@post
                binding.playlistSearchInput.requestFocus()
                binding.playlistSearchInput.context.getSystemService<InputMethodManager>()
                    ?.showSoftInput(binding.playlistSearchInput, InputMethodManager.SHOW_IMPLICIT)
            }
        }
    }

    private fun bindArtwork(artwork: PlaylistHeaderArtwork) {
        val source = when (artwork) {
            is PlaylistHeaderArtwork.Remote -> artwork.url.replace("{size}", "480")
                .takeIf { it.isNotBlank() }
            is PlaylistHeaderArtwork.DrawableRes -> artwork.resId
            is PlaylistHeaderArtwork.LocalPlaylist -> localArtworkSource(artwork.value)
        }
        binding.heroCoverImageView.load(source) {
            crossfade(true)
            placeholder(R.drawable.bg_mine_header)
            error(R.drawable.bg_mine_header)
        }
    }

    private fun localArtworkSource(value: String): Any {
        MinePlaylistCoverResolver.localFileForCover(value)?.let { return it }
        MinePlaylistCoverResolver.localTemplateRes(value)?.let { return it }
        if (value.startsWith("http://") || value.startsWith("https://")) return value
        return MinePlaylistCoverResolver.defaultLocalCoverRes()
    }
}
