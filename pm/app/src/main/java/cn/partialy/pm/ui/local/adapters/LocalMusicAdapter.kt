package cn.partialy.pm.ui.local.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemSongListBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongListItemActions
import cn.partialy.pm.ui.widget.SongListItemBinder
import cn.partialy.pm.ui.widget.SongListItemOptions
import cn.partialy.pm.ui.widget.SongListPlaybackState
import cn.partialy.pm.ui.widget.SongListPlaybackStateDelegate
import cn.partialy.pm.ui.widget.SongListPlaybackStateTarget

class LocalMusicAdapter(
    private val onSongClick: (SongInfo, Int) -> Unit,
    private val onMoreBtnClick: (SongInfo, Int) -> Unit,
) : ListAdapter<SongInfo, LocalMusicAdapter.ViewHolder>(LocalMusicDiffCallback()),
    SongListPlaybackStateTarget {

    private val playbackStateDelegate = SongListPlaybackStateDelegate(
        indexOfSong = ::indexOfSong,
        notifyItemChanged = ::notifyItemChanged,
    )

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSongListBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val songInfo = getItem(position)
        holder.bind(songInfo)
    }

    inner class ViewHolder(binding: ItemSongListBinding) : RecyclerView.ViewHolder(binding.root) {

        private val itemBinder = SongListItemBinder(binding)

        fun bind(songInfo: SongInfo) {
            itemBinder.bind(
                song = songInfo,
                options = SongListItemOptions(
                    showLove = false,
                    showDownload = false,
                    showMore = true,
                ),
                playbackState = playbackStateDelegate.state,
                actions = SongListItemActions(
                    onClick = { onSongClick(it, bindingAdapterPosition) },
                    onMoreClick = { onMoreBtnClick(it, bindingAdapterPosition) },
                ),
            )
        }
    }

    override fun updatePlaybackState(state: SongListPlaybackState) {
        playbackStateDelegate.updatePlaybackState(state)
    }

    private fun indexOfSong(song: SongInfo): Int = currentList.indexOfFirst {
        it.type == song.type && it.id == song.id
    }
}

class LocalMusicDiffCallback : DiffUtil.ItemCallback<SongInfo>() {
    override fun areItemsTheSame(oldItem: SongInfo, newItem: SongInfo): Boolean {
        return oldItem.type == newItem.type && oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: SongInfo, newItem: SongInfo): Boolean {
        return oldItem == newItem
    }
}
