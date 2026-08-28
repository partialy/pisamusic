package cn.partialy.pm.ui.home.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemSongListBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.widget.SongListItemActions
import cn.partialy.pm.ui.widget.SongListItemBinder
import cn.partialy.pm.ui.widget.SongListItemOptions
import cn.partialy.pm.ui.widget.SongListPlaybackState
import cn.partialy.pm.ui.widget.SongListPlaybackStateDelegate
import cn.partialy.pm.ui.widget.SongListPlaybackStateTarget
import javax.inject.Inject

class FavoriteSongsAdapter @Inject constructor(
    private val onSongClick: (SongInfo, Int) -> Unit,
    private val onDownloadBtnClick: (SongInfo, Int) -> Unit,
    private val onMoreBtnClick: (SongInfo, Int) -> Unit,
) : ListAdapter<SongInfo, FavoriteSongsAdapter.ViewHolder>(FavoriteSongDiffCallback()),
    SongListPlaybackStateTarget {

    private val playbackStateDelegate = SongListPlaybackStateDelegate(
        indexOfSong = ::indexOfSong,
        notifyItemChanged = ::notifyItemChanged,
    )

    inner class ViewHolder(binding: ItemSongListBinding) : RecyclerView.ViewHolder(binding.root) {
        private val itemBinder = SongListItemBinder(binding)

        fun bind(song: SongInfo) {
            itemBinder.bind(
                song = song,
                options = SongListItemOptions(
                    showLove = false,
                    showDownload = song.type != SongType.LOCAL,
                ),
                playbackState = playbackStateDelegate.state,
                actions = SongListItemActions(
                    onClick = { onSongClick(it, bindingAdapterPosition) },
                    onDownloadClick = { onDownloadBtnClick(it, bindingAdapterPosition) },
                    onMoreClick = { onMoreBtnClick(it, bindingAdapterPosition) },
                ),
            )
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSongListBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    fun updateSongs(songs: List<SongInfo>) {
        submitList(songs)
    }

    override fun updatePlaybackState(state: SongListPlaybackState) {
        playbackStateDelegate.updatePlaybackState(state)
    }

    private fun indexOfSong(song: SongInfo): Int = currentList.indexOfFirst {
        it.type == song.type && it.id == song.id
    }
}

class FavoriteSongDiffCallback : DiffUtil.ItemCallback<SongInfo>() {
    override fun areItemsTheSame(oldItem: SongInfo, newItem: SongInfo): Boolean {
        return oldItem.type == newItem.type && oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: SongInfo, newItem: SongInfo): Boolean {
        return oldItem == newItem
    }
}
