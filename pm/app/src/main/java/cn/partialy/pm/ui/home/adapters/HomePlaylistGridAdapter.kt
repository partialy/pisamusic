package cn.partialy.pm.ui.home.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemHomeRecommendPlaylistBinding
import cn.partialy.pm.model.HomeRecommendPlaylist
import cn.partialy.pm.model.toCanonicalSource
import cn.partialy.pm.utils.SongCoverUrl
import coil.dispose
import coil.load
import kotlin.math.max

class HomePlaylistGridAdapter(
    private val onItemClick: (HomeRecommendPlaylist) -> Unit,
) : ListAdapter<HomeRecommendPlaylist, HomePlaylistGridAdapter.Vh>(Diff) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Vh {
        val binding = ItemHomeRecommendPlaylistBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        val availableWidth = if (parent.measuredWidth > 0) {
            parent.measuredWidth - parent.paddingStart - parent.paddingEnd
        } else {
            val screenW = parent.resources.displayMetrics.widthPixels
            val horizontalPadding = parent.resources.getDimensionPixelSize(R.dimen.pm_page_content_start) * 2
            screenW - horizontalPadding
        }
        val itemW = max(1, availableWidth / 3)
        val coverSize = max(1, itemW - binding.root.paddingStart - binding.root.paddingEnd)
        binding.root.layoutParams = RecyclerView.LayoutParams(itemW, RecyclerView.LayoutParams.WRAP_CONTENT)
        // 纵向网格卡片高度为 WRAP_CONTENT，必须固定封面为正方形高度，避免被占位图或大图固有高度撑高整行。
        binding.coverContainer.minimumHeight = 0
        binding.coverContainer.layoutParams =
            (binding.coverContainer.layoutParams as LinearLayout.LayoutParams).apply {
                height = coverSize
                weight = 0f
            }
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
                val source = item.sourceType.toCanonicalSource().takeUnless { it == "local" }.orEmpty()
                binding.coverImageView.load(
                    SongCoverUrl.getRemoteCover(source, item.coverUrl, SongCoverUrl.SIZE_MEDIUM),
                ) {
                    placeholder(R.drawable.default_music_cover)
                    error(R.drawable.default_music_cover)
                    fallback(R.drawable.default_music_cover)
                }
            } else {
                binding.coverImageView.dispose()
                binding.coverImageView.setImageResource(R.drawable.default_music_cover)
            }
            binding.root.setOnClickListener { onItemClick(item) }
        }
    }

    private object Diff : DiffUtil.ItemCallback<HomeRecommendPlaylist>() {
        override fun areItemsTheSame(a: HomeRecommendPlaylist, b: HomeRecommendPlaylist) =
            a.id == b.id && a.sourceType == b.sourceType

        override fun areContentsTheSame(a: HomeRecommendPlaylist, b: HomeRecommendPlaylist) = a == b
    }
}
