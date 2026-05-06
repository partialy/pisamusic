package cn.partialy.pm.ui.home.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemFavoriteSongBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import coil.load
import javax.inject.Inject

class FavoriteSongsAdapter @Inject constructor(
    private val onSongClick: (SongInfo, Int) -> Unit,
    private val onDownloadBtnClick: (SongInfo, Int) -> Unit,
    private val onMoreBtnClick: (SongInfo, Int) -> Unit,
) : ListAdapter<SongInfo, FavoriteSongsAdapter.ViewHolder>(FavoriteSongDiffCallback()) {

    inner class ViewHolder(private val binding: ItemFavoriteSongBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(song: SongInfo, onClick: (SongInfo, Int) -> Unit) {
            binding.apply {
                songNameTextView.text = song.name
                singerTextView.text = song.artist
                SongSourceTagBinder.bind(songSourceTagTextView, song.type)
                coverImageView.load(song.coverUrl.replace("{size}","120"))
            }
            val position = bindingAdapterPosition
            binding.apply {
                root.setOnClickListener { onClick(song, position) }
                btnDownload.setOnClickListener { onDownloadBtnClick(song, position) }
                btnMore.setOnClickListener { onMoreBtnClick(song, position) }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemFavoriteSongBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val song = getItem(position)
        holder.bind(song, onSongClick)
    }

    fun updateSongs(songs: List<SongInfo>) {
        submitList(songs)
    }
}

class FavoriteSongDiffCallback : DiffUtil.ItemCallback<SongInfo>() {
    override fun areItemsTheSame(oldItem: SongInfo, newItem: SongInfo): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: SongInfo, newItem: SongInfo): Boolean {
        return oldItem == newItem
    }
}
