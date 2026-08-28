package cn.partialy.pm.ui.home.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemSongListBinding
import cn.partialy.pm.model.RecommendSongInfo
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongListItemActions
import cn.partialy.pm.ui.widget.SongListItemBinder
import cn.partialy.pm.ui.widget.SongListItemOptions
import cn.partialy.pm.ui.widget.SongListPlaybackState
import cn.partialy.pm.ui.widget.SongListPlaybackStateDelegate
import cn.partialy.pm.ui.widget.SongListPlaybackStateTarget
import javax.inject.Inject

class RecommendedSongsAdapter @Inject constructor(
    private val onSongClick: (SongInfo, Int) -> Unit,
    private val onDownloadBtnClick: (SongInfo, Int) -> Unit,
    private val onMoreBtnClick: (SongInfo, Int) -> Unit,
) : ListAdapter<RecommendSongInfo, RecommendedSongsAdapter.ViewHolder>(RecommendSongDiffCallback()),
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
                options = SongListItemOptions(showLove = false),
                playbackState = playbackStateDelegate.state,
                actions = SongListItemActions(
                    onClick = { dispatchAtCurrentPosition(it, onSongClick) },
                    onDownloadClick = { dispatchAtCurrentPosition(it, onDownloadBtnClick) },
                    onMoreClick = { dispatchAtCurrentPosition(it, onMoreBtnClick) },
                ),
            )
        }

        private fun dispatchAtCurrentPosition(song: SongInfo, action: (SongInfo, Int) -> Unit) {
            val position = bindingAdapterPosition
            if (position != RecyclerView.NO_POSITION) action(song, position)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSongListBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val song = getItem(position)
        holder.bind(song.convertToSongInfo())
    }

    fun updateSongs(songs:List<RecommendSongInfo>){
        submitList(songs)
    }

    override fun updatePlaybackState(state: SongListPlaybackState) {
        playbackStateDelegate.updatePlaybackState(state)
    }

    private fun indexOfSong(song: SongInfo): Int = currentList.indexOfFirst { item ->
        val candidate = item.convertToSongInfo()
        candidate.type == song.type && candidate.id == song.id
    }
}

class RecommendSongDiffCallback : DiffUtil.ItemCallback<RecommendSongInfo>() {
    override fun areItemsTheSame(oldItem: RecommendSongInfo, newItem: RecommendSongInfo): Boolean {
        return oldItem.hash == newItem.hash && oldItem.sourceType == newItem.sourceType
    }

    override fun areContentsTheSame(oldItem: RecommendSongInfo, newItem: RecommendSongInfo): Boolean {
        return oldItem == newItem
    }
}
