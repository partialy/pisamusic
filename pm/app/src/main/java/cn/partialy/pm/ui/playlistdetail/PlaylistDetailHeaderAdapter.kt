package cn.partialy.pm.ui.playlistdetail

import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import androidx.core.content.getSystemService
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.recyclerview.widget.RecyclerView
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
    val inlinePlayAllVisible: Boolean = true,
)

internal data class PlaylistDetailHeaderActions(
    val onPlayAll: () -> Unit = {},
    val onSearchRequested: () -> Unit = {},
    val onSearchQueryChanged: (String) -> Unit = {},
    val onSearchCancelled: () -> Unit = {},
)

class PlaylistDetailHeaderAdapter : RecyclerView.Adapter<PlaylistDetailHeaderAdapter.HeaderViewHolder>() {

    var state: PlaylistDetailHeaderState = PlaylistDetailHeaderState()
        private set

    internal var onStateChanged: ((PlaylistDetailHeaderState) -> Unit)? = null

    private var actions = PlaylistDetailHeaderActions()
    private var requestSearchFocusOnNextBind = false

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
        notifyItemChanged(0)
        onStateChanged?.invoke(state)
    }

    fun setSearchState(expanded: Boolean, query: String, requestFocus: Boolean = false) {
        state = state.copy(searchExpanded = expanded, searchQuery = query)
        requestSearchFocusOnNextBind = requestFocus
        notifyItemChanged(0)
        onStateChanged?.invoke(state)
    }

    internal fun rememberSearchQuery(query: String) {
        state = state.copy(searchQuery = query)
    }

    fun setInlinePlayAllVisible(visible: Boolean) {
        if (state.inlinePlayAllVisible == visible) return
        state = state.copy(inlinePlayAllVisible = visible)
        notifyItemChanged(0)
        onStateChanged?.invoke(state)
    }

    internal fun setActions(actions: PlaylistDetailHeaderActions) {
        this.actions = actions
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HeaderViewHolder =
        HeaderViewHolder(
            ItemPlaylistDetailHeaderBinding.inflate(
                LayoutInflater.from(parent.context),
                parent,
                false,
            ),
        )

    override fun onBindViewHolder(holder: HeaderViewHolder, position: Int) {
        val requestFocus = requestSearchFocusOnNextBind
        requestSearchFocusOnNextBind = false
        holder.bind(state, actions, requestFocus)
    }

    override fun getItemCount(): Int = 1

    class HeaderViewHolder(
        private val binding: ItemPlaylistDetailHeaderBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        private var searchWatcher: TextWatcher? = null

        internal fun bind(
            state: PlaylistDetailHeaderState,
            actions: PlaylistDetailHeaderActions,
            requestFocus: Boolean,
        ) {
            binding.playlistTitleTextView.text = state.title
            binding.playlistDescTextView.text = state.description
            binding.trackCountTextView.text = state.trackCountText
            bindArtwork(state.artwork)

            binding.playAllRow.visibility =
                if (state.inlinePlayAllVisible) View.VISIBLE else View.INVISIBLE
            binding.playAllRow.setOnClickListener { }
            binding.playAllActionContainer.setOnClickListener { actions.onPlayAll() }
            binding.searchPlaylistHeaderButton.setOnClickListener { actions.onSearchRequested() }
            binding.playlistSearchCancelText.setOnClickListener { actions.onSearchCancelled() }

            searchWatcher?.let(binding.playlistSearchInput::removeTextChangedListener)
            if (binding.playlistSearchInput.text.toString() != state.searchQuery) {
                binding.playlistSearchInput.setText(state.searchQuery)
                binding.playlistSearchInput.setSelection(state.searchQuery.length)
            }
            searchWatcher = binding.playlistSearchInput.doAfterTextChanged {
                actions.onSearchQueryChanged(it?.toString().orEmpty())
            }
            binding.playlistSearchBarLayout.isVisible = state.searchExpanded

            if (state.searchExpanded && requestFocus) {
                binding.playlistSearchInput.post {
                    binding.playlistSearchInput.requestFocus()
                    binding.playlistSearchInput.context.getSystemService<InputMethodManager>()
                        ?.showSoftInput(binding.playlistSearchInput, InputMethodManager.SHOW_IMPLICIT)
                }
            }
        }

        private fun bindArtwork(artwork: PlaylistHeaderArtwork) {
            val source = when (artwork) {
                is PlaylistHeaderArtwork.Remote -> artwork.url.replace("{size}", "240")
                    .takeIf { it.isNotBlank() }
                is PlaylistHeaderArtwork.DrawableRes -> artwork.resId
                is PlaylistHeaderArtwork.LocalPlaylist -> localArtworkSource(artwork.value)
            }
            binding.coverImageView.load(source) {
                crossfade(true)
                placeholder(R.drawable.ic_playlist_24)
                error(R.drawable.ic_playlist_24)
            }
            binding.headerBgImageView.load(source) {
                crossfade(true)
                placeholder(R.drawable.bg_mine_header)
                error(R.drawable.bg_mine_header)
            }
            binding.headerBlurImageView.load(source) {
                crossfade(true)
                placeholder(R.drawable.bg_mine_header)
                error(R.drawable.bg_mine_header)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                binding.headerBlurImageView.setRenderEffect(
                    RenderEffect.createBlurEffect(220f, 220f, Shader.TileMode.CLAMP),
                )
            } else {
                binding.headerBlurImageView.setRenderEffect(null)
            }
        }

        private fun localArtworkSource(value: String): Any {
            MinePlaylistCoverResolver.localFileForCover(value)?.let { return it }
            MinePlaylistCoverResolver.localTemplateRes(value)?.let { return it }
            if (value.startsWith("http://") || value.startsWith("https://")) return value
            return MinePlaylistCoverResolver.defaultLocalCoverRes()
        }
    }
}
