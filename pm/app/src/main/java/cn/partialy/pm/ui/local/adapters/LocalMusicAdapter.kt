package cn.partialy.pm.ui.local.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemLocalMusicBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import coil.load

class LocalMusicAdapter(
    private val onSongClick: (SongInfo, Int) -> Unit,
    private val onDownloadBtnClick: (SongInfo, Int) -> Unit,
    private val onMoreBtnClick: (SongInfo, Int) -> Unit,
) : ListAdapter<SongInfo, LocalMusicAdapter.ViewHolder>(LocalMusicDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemLocalMusicBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val songInfo = getItem(position)
        holder.bind(songInfo)
    }

    inner class ViewHolder(private val binding: ItemLocalMusicBinding) : RecyclerView.ViewHolder(binding.root) {

        fun bind(songInfo: SongInfo) {
            val position = bindingAdapterPosition
            binding.apply {
                root.setOnClickListener { onSongClick(songInfo, position) }
                titleTextView.text = songInfo.name
                artistTextView.text = songInfo.artist
                SongSourceTagBinder.bind(songSourceTagTextView, songInfo.type)
                val coverData = songInfo.embeddedCoverArt ?: songInfo.coverUrl.takeIf { it.isNotBlank() }
                coverImageView.load(coverData) {
                    placeholder(R.drawable.ic_pm_icon)
                    error(R.drawable.ic_pm_icon)
                }
                btnMore.setOnClickListener { onMoreBtnClick(songInfo, position) }
            }
        }
    }
}

class LocalMusicDiffCallback : DiffUtil.ItemCallback<SongInfo>() {
    override fun areItemsTheSame(oldItem: SongInfo, newItem: SongInfo): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: SongInfo, newItem: SongInfo): Boolean {
        return oldItem == newItem
    }
}
