package cn.partialy.pm.ui.cloudmusic

import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import androidx.annotation.StringRes
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemCloudMusicHeaderBinding
import cn.partialy.pm.databinding.ItemCloudMusicSongBinding
import cn.partialy.pm.databinding.ItemCloudMusicStatusBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import coil.load
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 云盘页单 RecyclerView 的差量行模型，避免头部输入框因整表刷新失焦。 */
sealed interface CloudMusicRow {
    data class Header(
        val total: Int,
        val latestUpdatedAt: Long?,
        val keyword: String,
    ) : CloudMusicRow

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
    private val onSubmitClick: () -> Unit,
    private val onKeywordChanged: (String) -> Unit,
    private val onSearchNow: () -> Unit,
    private val onSongClick: (SongInfo) -> Unit,
    private val onDownloadClick: (SongInfo) -> Unit,
    private val onMoreClick: (SongInfo) -> Unit,
    private val onRetryFirstPage: () -> Unit,
    private val onRetryLoadMore: () -> Unit,
) : ListAdapter<CloudMusicRow, RecyclerView.ViewHolder>(ROW_DIFF) {

    fun submitState(state: CloudMusicUiState) = submitList(buildRows(state))

    override fun getItemViewType(position: Int): Int = when (getItem(position)) {
        is CloudMusicRow.Header -> VIEW_TYPE_HEADER
        is CloudMusicRow.Song -> VIEW_TYPE_SONG
        is CloudMusicRow.Status -> VIEW_TYPE_STATUS
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder = when (viewType) {
        VIEW_TYPE_HEADER -> HeaderHolder(
            ItemCloudMusicHeaderBinding.inflate(LayoutInflater.from(parent.context), parent, false),
        )
        VIEW_TYPE_SONG -> SongHolder(
            ItemCloudMusicSongBinding.inflate(LayoutInflater.from(parent.context), parent, false),
        )
        else -> StatusHolder(
            ItemCloudMusicStatusBinding.inflate(LayoutInflater.from(parent.context), parent, false),
        )
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (holder) {
            is HeaderHolder -> holder.bind(getItem(position) as CloudMusicRow.Header)
            is SongHolder -> holder.bind((getItem(position) as CloudMusicRow.Song).value)
            is StatusHolder -> holder.bind(getItem(position) as CloudMusicRow.Status)
        }
    }

    private inner class HeaderHolder(
        private val binding: ItemCloudMusicHeaderBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        private var applyingProgrammaticKeyword = false

        init {
            binding.cloudMusicSubmitButton.setOnClickListener { onSubmitClick() }
            binding.cloudMusicSearchInput.doAfterTextChanged { editable ->
                if (!applyingProgrammaticKeyword) {
                    onKeywordChanged(editable?.toString().orEmpty())
                }
            }
            binding.cloudMusicSearchInput.setOnEditorActionListener { _, actionId, _ ->
                if (actionId != EditorInfo.IME_ACTION_SEARCH) return@setOnEditorActionListener false
                onSearchNow()
                true
            }
        }

        fun bind(row: CloudMusicRow.Header) = with(binding) {
            cloudMusicSummaryCount.text = root.context.getString(R.string.cloud_music_summary_count, row.total)
            cloudMusicSummaryUpdated.text = row.latestUpdatedAt?.let {
                root.context.getString(R.string.cloud_music_summary_updated, formatDate(root.context, it))
            } ?: root.context.getString(R.string.cloud_music_summary_no_update)
            if (!cloudMusicSearchInput.hasFocus() && cloudMusicSearchInput.text?.toString() != row.keyword) {
                applyingProgrammaticKeyword = true
                cloudMusicSearchInput.setText(row.keyword)
                cloudMusicSearchInput.setSelection(row.keyword.length)
                applyingProgrammaticKeyword = false
            }
        }
    }

    private inner class SongHolder(
        private val binding: ItemCloudMusicSongBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(song: SongInfo) = with(binding) {
            val playable = song.playable
            cloudMusicSongName.text = song.name
            cloudMusicSubtitle.text = root.context.getString(
                R.string.cloud_music_song_subtitle,
                song.artist,
                song.album?.takeIf { it.isNotBlank() } ?: root.context.getString(R.string.cloud_music_unknown_album),
            )
            cloudMusicDuration.text = formatDuration(root.context, song.duration ?: 0)
            cloudMusicDisabledBadge.isVisible = !playable
            cloudMusicDownloadButton.isEnabled = playable
            root.alpha = if (playable) 1f else DISABLED_ALPHA
            SongSourceTagBinder.bind(cloudMusicSourceTag, song.type)
            cloudMusicCover.load(SongCoverUrl.getSongCover(song, SongCoverUrl.SIZE_SMALL)) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
            root.setOnClickListener { onSongClick(song) }
            cloudMusicDownloadButton.setOnClickListener { onDownloadClick(song) }
            cloudMusicMoreButton.setOnClickListener { onMoreClick(song) }
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
        add(CloudMusicRow.Header(state.total, state.latestUpdatedAt, state.keyword))
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

    private fun formatDate(context: Context, timestamp: Long): String = SimpleDateFormat(
        context.getString(R.string.cloud_music_date_pattern),
        Locale.getDefault(),
    ).format(Date(timestamp))

    private fun formatDuration(context: android.content.Context, durationMs: Int): String {
        val totalSeconds = (durationMs.coerceAtLeast(0) / 1000)
        return context.getString(R.string.cloud_music_duration, totalSeconds / 60, totalSeconds % 60)
    }

    private companion object {
        const val VIEW_TYPE_HEADER = 1
        const val VIEW_TYPE_SONG = 2
        const val VIEW_TYPE_STATUS = 3
        const val DISABLED_ALPHA = 0.56f

        val ROW_DIFF = object : DiffUtil.ItemCallback<CloudMusicRow>() {
            override fun areItemsTheSame(oldItem: CloudMusicRow, newItem: CloudMusicRow): Boolean = when {
                oldItem is CloudMusicRow.Header && newItem is CloudMusicRow.Header -> true
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
