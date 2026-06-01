package cn.partialy.pm.ui.home.adapters

import android.animation.Animator
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.view.View
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemHomeRecommendPlaylistBinding
import cn.partialy.pm.model.HomeRecommendPlaylist
import coil.load
import kotlin.math.max

class HomeRecommendPlaylistAdapter(
    private val onItemClick: (HomeRecommendPlaylist) -> Unit,
) : ListAdapter<HomeRecommendPlaylist, HomeRecommendPlaylistAdapter.Vh>(Diff) {
    private var showSkeleton = false
    private val skeletonCount = 6

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
        val binding = ItemHomeRecommendPlaylistBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        val screenW = parent.resources.displayMetrics.widthPixels
        val itemW = max(1, (screenW * 0.3f).toInt())
        binding.root.layoutParams = RecyclerView.LayoutParams(itemW, RecyclerView.LayoutParams.MATCH_PARENT)
        return Vh(binding, onItemClick)
    }

    override fun onBindViewHolder(holder: Vh, position: Int) {
        if (showSkeleton) {
            holder.bindSkeleton()
        } else {
            holder.bind(getItem(position))
        }
    }

    override fun getItemCount(): Int {
        return if (showSkeleton) skeletonCount else super.getItemCount()
    }

    class Vh(
        private val binding: ItemHomeRecommendPlaylistBinding,
        private val onItemClick: (HomeRecommendPlaylist) -> Unit,
    ) : RecyclerView.ViewHolder(binding.root) {
        private var skeletonAnimator: Animator? = null

        private fun stopSkeletonAnim() {
            skeletonAnimator?.cancel()
            skeletonAnimator = null
            binding.coverImageView.alpha = 1f
            binding.titleTextView.alpha = 1f
        }

        private fun startSkeletonAnim() {
            if (skeletonAnimator != null) return
            val cover = ObjectAnimator.ofFloat(binding.coverImageView, View.ALPHA, 0.35f, 0.85f).apply {
                duration = 850L
                repeatMode = ValueAnimator.REVERSE
                repeatCount = ValueAnimator.INFINITE
            }
            val title = ObjectAnimator.ofFloat(binding.titleTextView, View.ALPHA, 0.35f, 0.85f).apply {
                duration = 850L
                startDelay = 100L
                repeatMode = ValueAnimator.REVERSE
                repeatCount = ValueAnimator.INFINITE
            }
            skeletonAnimator = AnimatorSet().apply {
                playTogether(cover, title)
                start()
            }
        }

        fun bind(item: HomeRecommendPlaylist) {
            stopSkeletonAnim()
            binding.coverImageView.alpha = 1f
            binding.titleTextView.text = item.name
            binding.titleTextView.background = null
            binding.playCountTextView.text = item.playCountLabel
            if (item.coverUrl.isNotBlank()) {
                binding.coverImageView.load(item.coverUrl)
            } else {
                binding.coverImageView.setImageResource(cn.partialy.pm.R.drawable.ic_playlist_24)
            }
            binding.root.isClickable = true
            binding.root.setOnClickListener { onItemClick(item) }
        }

        fun bindSkeleton() {
            startSkeletonAnim()
            binding.coverImageView.setImageResource(cn.partialy.pm.R.drawable.ic_playlist_24)
            binding.coverImageView.alpha = 0.25f
            binding.playCountTextView.text = ""
            binding.playCountTextView.background = null
            binding.titleTextView.text = ""
            binding.titleTextView.setBackgroundResource(cn.partialy.pm.R.drawable.bg_skeleton_rounded)
            binding.root.setOnClickListener(null)
            binding.root.isClickable = false
        }
    }

    private object Diff : DiffUtil.ItemCallback<HomeRecommendPlaylist>() {
        override fun areItemsTheSame(a: HomeRecommendPlaylist, b: HomeRecommendPlaylist) =
            a.id == b.id && a.sourceType == b.sourceType

        override fun areContentsTheSame(a: HomeRecommendPlaylist, b: HomeRecommendPlaylist) = a == b
    }
}
