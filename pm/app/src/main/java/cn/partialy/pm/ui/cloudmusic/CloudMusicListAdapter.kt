package cn.partialy.pm.ui.cloudmusic

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.annotation.StringRes
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemCloudMusicStatusBinding
import cn.partialy.pm.databinding.ItemRecommendSongBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import coil.load

/** 云盘歌曲列表行模型（Header 已移至顶部固定区域）。 */
sealed interface CloudMusicRow {
    data class Song(val value: SongInfo) : CloudMusicRow

    data class Status(
        val kind: CloudMusicStatusKind,
        @StringRes val messageResId: Int,
    ) : CloudMusicRow
}

enum class CloudMusicStatusKind {
    INITIAL_LOADING,
    LOADING_MORE,
    EMPTY,
    SEARCH_EMPTY,
    FIRST_PAGE_ERROR,
    LOAD_MORE_ERROR,
}

class CloudMusicListAdapter(
    private val isSongLiked: (SongInfo) -> Boolean,
    private val onLoveClick: (SongInfo) -> Unit,
    private val onSongClick: (SongInfo) -> Unit,
    private val onDownloadClick: (SongInfo) -> Unit,
    private val onMoreClick: (SongInfo) -> Unit,
    private val onRetryFirstPage: () -> Unit,
    private val onRetryLoadMore: () -> Unit,
) : ListAdapter<CloudMusicRow, RecyclerView.ViewHolder>(ROW_DIFF) {

    fun submitState(state: CloudMusicUiState) = submitList(buildRows(state))

    fun notifySongChanged(song: SongInfo) {
        val index = currentList.indexOfFirst {
            it is CloudMusicRow.Song && it.value.id == song.id && it.value.type == song.type
        }
        if (index >= 0) {
            notifyItemChanged(index)
        }
    }

    override fun getItemViewType(position: Int): Int = when (getItem(position)) {
        is CloudMusicRow.Song -> VIEW_TYPE_SONG
        is CloudMusicRow.Status -> VIEW_TYPE_STATUS
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder = when (viewType) {
        VIEW_TYPE_SONG -> SongHolder(
            ItemRecommendSongBinding.inflate(LayoutInflater.from(parent.context), parent, false),
        )
        else -> StatusHolder(
            ItemCloudMusicStatusBinding.inflate(LayoutInflater.from(parent.context), parent, false),
        )
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (holder) {
            is SongHolder -> holder.bind((getItem(position) as CloudMusicRow.Song).value)
            is StatusHolder -> holder.bind(getItem(position) as CloudMusicRow.Status)
        }
    }

    private inner class SongHolder(
        private val binding: ItemRecommendSongBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(song: SongInfo) = with(binding) {
            val context = root.context
            val playable = song.playable
            songNameTextView.text = song.name
            singerTextView.text = song.artist
            SongSourceTagBinder.bind(songSourceTagTextView, song.type)
            coverImageView.load(SongCoverUrl.getSongCover(song, SongCoverUrl.SIZE_SMALL)) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
            val liked = isSongLiked(song)
            btnLove.setImageResource(
                if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
            )
            btnLove.imageTintList = ContextCompat.getColorStateList(
                context,
                if (liked) R.color.red else R.color.home_tab_unselected,
            )
            root.alpha = if (playable) 1f else DISABLED_ALPHA
            btnDownload.isEnabled = playable
            btnDownload.alpha = if (playable) 1f else 0.4f

            root.setOnClickListener { onSongClick(song) }
            btnLove.setOnClickListener { onLoveClick(song) }
            btnDownload.setOnClickListener { onDownloadClick(song) }
            btnMore.setOnClickListener { onMoreClick(song) }
        }
    }

    private inner class StatusHolder(
        private val binding: ItemCloudMusicStatusBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(row: CloudMusicRow.Status) = with(binding) {
            cloudMusicStatusProgress.isVisible = row.kind == CloudMusicStatusKind.INITIAL_LOADING ||
                row.kind == CloudMusicStatusKind.LOADING_MORE
            cloudMusicRetryButton.isVisible = row.kind == CloudMusicStatusKind.FIRST_PAGE_ERROR ||
                row.kind == CloudMusicStatusKind.LOAD_MORE_ERROR
            cloudMusicStatusText.setText(row.messageResId)
            cloudMusicRetryButton.setOnClickListener {
                if (row.kind == CloudMusicStatusKind.LOAD_MORE_ERROR) {
                    onRetryLoadMore()
                } else {
                    onRetryFirstPage()
                }
            }
        }
    }

    private fun buildRows(state: CloudMusicUiState): List<CloudMusicRow> = buildList {
        state.items.forEach { add(CloudMusicRow.Song(it)) }
        statusRow(state)?.let(::add)
    }

    private fun statusRow(state: CloudMusicUiState): CloudMusicRow.Status? = when {
        state.initialLoading -> CloudMusicRow.Status(
            CloudMusicStatusKind.INITIAL_LOADING,
            R.string.cloud_music_loading,
        )
        state.error?.phase == CloudMusicErrorPhase.FIRST_PAGE -> CloudMusicRow.Status(
            CloudMusicStatusKind.FIRST_PAGE_ERROR,
            state.error.messageResId,
        )
        state.items.isEmpty() && state.keyword.isNotBlank() -> CloudMusicRow.Status(
            CloudMusicStatusKind.SEARCH_EMPTY,
            R.string.cloud_music_search_empty,
        )
        state.items.isEmpty() -> CloudMusicRow.Status(
            CloudMusicStatusKind.EMPTY,
            R.string.cloud_music_empty,
        )
        state.loadingMore -> CloudMusicRow.Status(
            CloudMusicStatusKind.LOADING_MORE,
            R.string.cloud_music_loading_more,
        )
        state.error?.phase == CloudMusicErrorPhase.LOAD_MORE -> CloudMusicRow.Status(
            CloudMusicStatusKind.LOAD_MORE_ERROR,
            state.error.messageResId,
        )
        else -> null
    }

    private companion object {
        const val VIEW_TYPE_SONG = 1
        const val VIEW_TYPE_STATUS = 2
        const val DISABLED_ALPHA = 0.56f

        val ROW_DIFF = object : DiffUtil.ItemCallback<CloudMusicRow>() {
            override fun areItemsTheSame(oldItem: CloudMusicRow, newItem: CloudMusicRow): Boolean = when {
                oldItem is CloudMusicRow.Song && newItem is CloudMusicRow.Song ->
                    oldItem.value.type == newItem.value.type && oldItem.value.id == newItem.value.id
                oldItem is CloudMusicRow.Status && newItem is CloudMusicRow.Status ->
                    oldItem.kind == newItem.kind
                else -> false
            }

            override fun areContentsTheSame(oldItem: CloudMusicRow, newItem: CloudMusicRow): Boolean =
                oldItem == newItem
        }
    }
}
