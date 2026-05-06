package cn.partialy.pm.ui.search.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemSearchResultBinding
import cn.partialy.pm.model.SearchTrackRow
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import coil.load

class SearchResultsAdapter(
    private val onItemClick: (SearchTrackRow) -> Unit = {},
    private val onDownloadClick: (SearchTrackRow) -> Unit = {},
    private val onMoreClick: (SearchTrackRow) -> Unit = {},
) : ListAdapter<SearchTrackRow, SearchResultsAdapter.ViewHolder>(SearchTrackRowDiffCallback()) {

    inner class ViewHolder(
        private val binding: ItemSearchResultBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(row: SearchTrackRow) {
            binding.apply {
                titleTextView.text = row.title
                artistTextView.text = row.artist
                SongSourceTagBinder.bind(songSourceTagTextView, row.source)
                if (row.coverUrl.isNotBlank()) {
                    coverImageView.load(row.coverUrl)
                } else {
                    coverImageView.setImageDrawable(null)
                }
                root.setOnClickListener { onItemClick(row) }
                btnDownload.setOnClickListener { onDownloadClick(row) }
                btnMore.setOnClickListener { onMoreClick(row) }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSearchResultBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false,
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }
}

private class SearchTrackRowDiffCallback : DiffUtil.ItemCallback<SearchTrackRow>() {
    override fun areItemsTheSame(oldItem: SearchTrackRow, newItem: SearchTrackRow): Boolean =
        oldItem.stableId == newItem.stableId

    override fun areContentsTheSame(oldItem: SearchTrackRow, newItem: SearchTrackRow): Boolean =
        oldItem == newItem
}
