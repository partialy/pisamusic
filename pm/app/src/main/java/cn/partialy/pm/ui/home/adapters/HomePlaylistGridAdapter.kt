package cn.partialy.pm.ui.home.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemHomeRecommendPlaylistBinding
import cn.partialy.pm.model.HomeRecommendPlaylist
import coil.load
import kotlin.math.max

class HomePlaylistGridAdapter(
    private val onItemClick: (HomeRecommendPlaylist) -> Unit,
) : ListAdapter<HomeRecommendPlaylist, HomePlaylistGridAdapter.Vh>(Diff) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Vh {
        val binding = ItemHomeRecommendPlaylistBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        val screenW = parent.resources.displayMetrics.widthPixels
        val horizontalPadding = (12f * parent.resources.displayMetrics.density).toInt() * 2
        val itemW = max(1, (screenW - horizontalPadding) / 3)
        binding.root.layoutParams = RecyclerView.LayoutParams(itemW, RecyclerView.LayoutParams.WRAP_CONTENT)
        return Vh(binding, onItemClick)
    }

    override fun onBindViewHolder(holder: Vh, position: Int) {
        holder.bind(getItem(position))
    }

    class Vh(
        private val binding: ItemHomeRecommendPlaylistBinding,
        private val onItemClick: (HomeRecommendPlaylist) -> Unit,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: HomeRecommendPlaylist) {
            binding.titleTextView.text = item.name
            binding.playCountTextView.text = item.playCountLabel
            if (item.coverUrl.isNotBlank()) {
                binding.coverImageView.load(item.coverUrl)
            } else {
                binding.coverImageView.setImageResource(R.drawable.ic_playlist_24)
            }
            binding.root.setOnClickListener { onItemClick(item) }
        }
    }

    private object Diff : DiffUtil.ItemCallback<HomeRecommendPlaylist>() {
        override fun areItemsTheSame(a: HomeRecommendPlaylist, b: HomeRecommendPlaylist) = a.id == b.id
        override fun areContentsTheSame(a: HomeRecommendPlaylist, b: HomeRecommendPlaylist) = a == b
    }
}
