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
import java.util.Locale

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
            return parts.joinToString(" · ")
        }

        private fun formatPlayCount(value: Long): String {
            if (value <= 0L) return "0"
            return when {
                value >= 100_000_000L -> String.format(Locale.CHINA, "%.1f亿", value / 100_000_000.0)
                value >= 10_000L -> String.format(Locale.CHINA, "%.1f万", value / 10_000.0)
                else -> value.toString()
            }
        }
    }

    private object Diff : DiffUtil.ItemCallback<SearchPlaylistInfo>() {
        override fun areItemsTheSame(a: SearchPlaylistInfo, b: SearchPlaylistInfo) = a.id == b.id
        override fun areContentsTheSame(a: SearchPlaylistInfo, b: SearchPlaylistInfo) = a == b
    }
}
