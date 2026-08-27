package cn.partialy.pm.ui.search.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemSearchPlaylistBinding
import cn.partialy.pm.model.SearchPlaylistInfo
import coil.load

class SearchPlaylistAdapter(
    private val onItemClick: (SearchPlaylistInfo) -> Unit,
) : ListAdapter<SearchPlaylistInfo, SearchPlaylistAdapter.Vh>(Diff) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Vh {
        val binding = ItemSearchPlaylistBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return Vh(binding)
    }

    override fun onBindViewHolder(holder: Vh, position: Int) {
        holder.bind(getItem(position))
    }

    inner class Vh(
        private val binding: ItemSearchPlaylistBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: SearchPlaylistInfo) {
            binding.titleTextView.text = item.name
            binding.subtitleTextView.text = buildSubtitle(item)
            if (item.coverUrl.isNotBlank()) {
                binding.coverImageView.load(item.coverUrl)
            } else {
                binding.coverImageView.setImageResource(R.drawable.ic_playlist_24)
            }
            binding.root.setOnClickListener { onItemClick(item) }
        }

        private fun buildSubtitle(item: SearchPlaylistInfo): String {
            val ctx = binding.root.context
            val parts = mutableListOf<String>()
            parts += ctx.getString(R.string.search_playlist_song_count, item.songCount)
            if (item.includeSongName.isNotBlank()) {
                parts += ctx.getString(R.string.search_playlist_include_song, item.includeSongName)
            }
            if (item.playCount > 0L) {
                parts += ctx.getString(
                    R.string.search_playlist_play_count,
                    formatPlayCount(item.playCount),
                )
            }
            return parts.joinToString(ctx.getString(R.string.common_separator_dot))
        }

        private fun formatPlayCount(value: Long): String {
            if (value <= 0L) return "0"
            val context = binding.root.context
            return when {
                value >= 100_000_000L -> context.getString(
                    R.string.search_play_count_hundred_million,
                    value / 100_000_000.0,
                )
                value >= 10_000L -> context.getString(
                    R.string.search_play_count_ten_thousand,
                    value / 10_000.0,
                )
                else -> value.toString()
            }
        }
    }

    private object Diff : DiffUtil.ItemCallback<SearchPlaylistInfo>() {
        override fun areItemsTheSame(a: SearchPlaylistInfo, b: SearchPlaylistInfo) = a.id == b.id
        override fun areContentsTheSame(a: SearchPlaylistInfo, b: SearchPlaylistInfo) = a == b
    }
}
