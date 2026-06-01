package cn.partialy.pm.ui.home.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemRecommendSongBinding
import cn.partialy.pm.model.RecommendSongInfo
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import coil.load
import javax.inject.Inject

class RecommendedSongsAdapter @Inject constructor(
    private val onSongClick: (SongInfo, Int) -> Unit,
    private val onDownloadBtnClick: (SongInfo, Int) -> Unit,
    private val onMoreBtnClick: (SongInfo, Int) -> Unit,
) : ListAdapter<RecommendSongInfo, RecommendedSongsAdapter.ViewHolder>(RecommendSongDiffCallback()) {

    inner class ViewHolder(private val binding: ItemRecommendSongBinding) : RecyclerView.ViewHolder(binding.root) {
 
        fun bind(song: SongInfo, onClick: (SongInfo, Int) -> Unit) {
            binding.apply {
                songNameTextView.text = song.name
                singerTextView.text = song.artist
                SongSourceTagBinder.bind(songSourceTagTextView, song.type)
                coverImageView.load(SongCoverUrl.getSongCover(song, SongCoverUrl.SIZE_SMALL))
                btnLove.visibility = View.GONE
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
        val binding = ItemRecommendSongBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val song = getItem(position)
        holder.bind(song.convertToSongInfo(),onSongClick)
    }

    fun updateSongs(songs:List<RecommendSongInfo>){
        submitList(songs)
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
