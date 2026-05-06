package cn.partialy.pm.ui.search.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemSearchSuggestionBinding
import cn.partialy.pm.model.SearchSongInfo

class SuggestionsAdapter(
    private val onItemClick: (String) -> Unit
) : ListAdapter<SearchSongInfo, SuggestionsAdapter.ViewHolder>(SuggestionDiffCallback()) {

    inner class ViewHolder(
        private val binding: ItemSearchSuggestionBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(song: SearchSongInfo) {
            val label = song.displayTitle().ifBlank { song.songName }
            binding.apply {
                suggestionTextView.text = label
                root.setOnClickListener {
                    onItemClick(label)
                }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSearchSuggestionBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }
}

private class SuggestionDiffCallback : DiffUtil.ItemCallback<SearchSongInfo>() {
    override fun areItemsTheSame(oldItem: SearchSongInfo, newItem: SearchSongInfo): Boolean {
        val a = oldItem.playHash().ifEmpty { oldItem.displayTitle() }
        val b = newItem.playHash().ifEmpty { newItem.displayTitle() }
        return a == b
    }

    override fun areContentsTheSame(oldItem: SearchSongInfo, newItem: SearchSongInfo): Boolean {
        return oldItem == newItem
    }
}
