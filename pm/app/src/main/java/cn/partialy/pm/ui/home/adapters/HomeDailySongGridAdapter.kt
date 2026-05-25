package cn.partialy.pm.ui.home.adapters

import android.animation.Animator
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.view.View
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemHomeDailySongBinding
import cn.partialy.pm.model.RecommendSongInfo
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import coil.load

class HomeDailySongGridAdapter(
    private val isLiked: (SongInfo) -> Boolean,
    private val onItemClick: (RecommendSongInfo, Int) -> Unit,
    private val onDownloadClick: (RecommendSongInfo, Int) -> Unit,
    private val onLoveClick: (RecommendSongInfo, Int) -> Unit,
    private val onMoreClick: (RecommendSongInfo, Int) -> Unit,
) : ListAdapter<RecommendSongInfo, HomeDailySongGridAdapter.Vh>(Diff) {
    private var showSkeleton = false
    private val skeletonCount = 12

    fun showSkeleton() {
        if (showSkeleton) return
        showSkeleton = true
        notifyDataSetChanged()
    }

    fun hideSkeleton() {
        if (!showSkeleton) return
        showSkeleton = false
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Vh {
        val binding = ItemHomeDailySongBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        val screenW = parent.resources.displayMetrics.widthPixels
        val itemW = (screenW * 0.9f).toInt()
        val itemH = parent.resources.getDimensionPixelSize(R.dimen.home_daily_song_row_height)
        binding.root.layoutParams = RecyclerView.LayoutParams(itemW, itemH)
        return Vh(binding)
    }

    override fun onBindViewHolder(holder: Vh, position: Int) {
        if (showSkeleton) {
            holder.bindSkeleton()
        } else {
            holder.bind(getItem(position), position)
        }
    }

    override fun getItemCount(): Int {
        return if (showSkeleton) skeletonCount else super.getItemCount()
    }

    inner class Vh(
        private val binding: ItemHomeDailySongBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        private var skeletonAnimator: Animator? = null

        private fun stopSkeletonAnim() {
            skeletonAnimator?.cancel()
            skeletonAnimator = null
            binding.coverImageView.alpha = 1f
            binding.songNameTextView.alpha = 1f
            binding.artistTextView.alpha = 1f
        }

        private fun startSkeletonAnim() {
            if (skeletonAnimator != null) return
            val cover = ObjectAnimator.ofFloat(binding.coverImageView, View.ALPHA, 0.35f, 0.85f).apply {
                duration = 850L
                repeatMode = ValueAnimator.REVERSE
                repeatCount = ValueAnimator.INFINITE
            }
            val song = ObjectAnimator.ofFloat(binding.songNameTextView, View.ALPHA, 0.35f, 0.85f).apply {
                duration = 850L
                startDelay = 80L
                repeatMode = ValueAnimator.REVERSE
                repeatCount = ValueAnimator.INFINITE
            }
            val artist = ObjectAnimator.ofFloat(binding.artistTextView, View.ALPHA, 0.35f, 0.85f).apply {
                duration = 850L
                startDelay = 140L
                repeatMode = ValueAnimator.REVERSE
                repeatCount = ValueAnimator.INFINITE
            }
            skeletonAnimator = AnimatorSet().apply {
                playTogether(cover, song, artist)
                start()
            }
        }

        fun bind(item: RecommendSongInfo, position: Int) {
            stopSkeletonAnim()
            val song = item.convertToSongInfo()
            binding.coverImageView.alpha = 1f
            binding.btnDownload.alpha = 1f
            binding.btnLove.alpha = 1f
            binding.btnMore.alpha = 1f
            binding.songNameTextView.text = item.songname
            binding.songNameTextView.background = null
            binding.artistTextView.text = item.author_name
            binding.artistTextView.background = null
            binding.coverImageView.load(SongCoverUrl.getKgImageUrl(item.sizable_cover, SongCoverUrl.SIZE_SMALL))
            SongSourceTagBinder.bind(binding.songSourceTagTextView, song.type)

            val liked = isLiked(song)
            binding.btnLove.setImageResource(if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24)
            binding.btnLove.imageTintList = ContextCompat.getColorStateList(
                binding.root.context,
                if (liked) R.color.red else R.color.home_tab_unselected,
            )

            binding.root.setOnClickListener { onItemClick(item, position) }
            binding.btnDownload.setOnClickListener { onDownloadClick(item, position) }
            binding.btnLove.setOnClickListener { onLoveClick(item, position) }
            binding.btnMore.setOnClickListener { onMoreClick(item, position) }
        }

        fun bindSkeleton() {
            startSkeletonAnim()
            binding.coverImageView.setImageResource(R.drawable.ic_pm_icon)
            binding.coverImageView.alpha = 0.25f
            binding.songNameTextView.text = ""
            binding.songNameTextView.setBackgroundResource(R.drawable.bg_skeleton_rounded)
            binding.artistTextView.text = ""
            binding.artistTextView.setBackgroundResource(R.drawable.bg_skeleton_rounded)
            binding.songSourceTagTextView.visibility = android.view.View.GONE
            binding.btnDownload.alpha = 0.2f
            binding.btnLove.alpha = 0.2f
            binding.btnMore.alpha = 0.2f
            binding.root.setOnClickListener(null)
            binding.btnDownload.setOnClickListener(null)
            binding.btnLove.setOnClickListener(null)
            binding.btnMore.setOnClickListener(null)
        }
    }

    fun refreshLoveStates() {
        notifyDataSetChanged()
    }

    private object Diff : DiffUtil.ItemCallback<RecommendSongInfo>() {
        override fun areItemsTheSame(a: RecommendSongInfo, b: RecommendSongInfo) = a.hash == b.hash
        override fun areContentsTheSame(a: RecommendSongInfo, b: RecommendSongInfo) = a == b
    }
}
