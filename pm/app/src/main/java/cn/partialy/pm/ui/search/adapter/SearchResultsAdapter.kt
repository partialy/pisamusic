package cn.partialy.pm.ui.search.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemSongListBinding
import cn.partialy.pm.model.SearchTrackRow
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongListItemActions
import cn.partialy.pm.ui.widget.SongListItemBinder
import cn.partialy.pm.ui.widget.SongListItemOptions
import cn.partialy.pm.ui.widget.SongListPlaybackState
import cn.partialy.pm.ui.widget.SongListPlaybackStateDelegate
import cn.partialy.pm.ui.widget.SongListPlaybackStateTarget

class SearchResultsAdapter(
    private val onItemClick: (SearchTrackRow) -> Unit = {},
    private val onDownloadClick: (SearchTrackRow) -> Unit = {},
    private val onMoreClick: (SearchTrackRow) -> Unit = {},
) : ListAdapter<SearchTrackRow, SearchResultsAdapter.ViewHolder>(SearchTrackRowDiffCallback()),
    SongListPlaybackStateTarget {

    private val playbackStateDelegate = SongListPlaybackStateDelegate(
        indexOfSong = ::indexOfSong,
        notifyItemChanged = ::notifyItemChanged,
    )

    inner class ViewHolder(
        binding: ItemSongListBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        private val itemBinder = SongListItemBinder(binding)

        fun bind(row: SearchTrackRow) {
            itemBinder.bind(
                song = row.toSongInfo(),
                options = SongListItemOptions(showLove = false),
                playbackState = playbackStateDelegate.state,
                actions = SongListItemActions(
                    onClick = { onItemClick(row) },
                    onDownloadClick = { onDownloadClick(row) },
                    onMoreClick = { onMoreClick(row) },
                ),
            )
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSongListBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false,
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    override fun updatePlaybackState(state: SongListPlaybackState) {
        playbackStateDelegate.updatePlaybackState(state)
    }

    private fun indexOfSong(song: SongInfo): Int = currentList.indexOfFirst { row ->
        row.source == song.type && row.playRef == song.id
    }
}

private class SearchTrackRowDiffCallback : DiffUtil.ItemCallback<SearchTrackRow>() {
    override fun areItemsTheSame(oldItem: SearchTrackRow, newItem: SearchTrackRow): Boolean =
        oldItem.source == newItem.source && oldItem.playRef == newItem.playRef

    override fun areContentsTheSame(oldItem: SearchTrackRow, newItem: SearchTrackRow): Boolean =
        oldItem == newItem
}
