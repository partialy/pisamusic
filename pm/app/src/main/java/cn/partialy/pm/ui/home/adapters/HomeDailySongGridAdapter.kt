package cn.partialy.pm.ui.home.adapters

import android.animation.Animator
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemSongListBinding
import cn.partialy.pm.model.RecommendSongInfo
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongListItemActions
import cn.partialy.pm.ui.widget.SongListItemBinder
import cn.partialy.pm.ui.widget.SongListItemOptions
import cn.partialy.pm.ui.widget.SongListPlaybackState
import cn.partialy.pm.ui.widget.SongListPlaybackStateDelegate
import cn.partialy.pm.ui.widget.SongListPlaybackStateTarget

class HomeDailySongGridAdapter(
    private val isLiked: (SongInfo) -> Boolean,
    private val onItemClick: (RecommendSongInfo, Int) -> Unit,
    private val onDownloadClick: (RecommendSongInfo, Int) -> Unit,
    private val onLoveClick: (RecommendSongInfo, Int) -> Unit,
    private val onMoreClick: (RecommendSongInfo, Int) -> Unit,
) : ListAdapter<RecommendSongInfo, HomeDailySongGridAdapter.Vh>(Diff),
    SongListPlaybackStateTarget {
    private var showSkeleton = false
    private val skeletonCount = 12
    private val playbackStateDelegate = SongListPlaybackStateDelegate(
        indexOfSong = ::indexOfSong,
        notifyItemChanged = ::notifyItemChanged,
    )

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
        val binding = ItemSongListBinding.inflate(LayoutInflater.from(parent.context), parent, false)
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
            holder.bind(getItem(position))
        }
    }

    override fun getItemCount(): Int {
        return if (showSkeleton) skeletonCount else super.getItemCount()
    }

    override fun onViewRecycled(holder: Vh) {
        holder.recycle()
        super.onViewRecycled(holder)
    }

    inner class Vh(
        private val binding: ItemSongListBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        private val itemBinder = SongListItemBinder(binding)
        private var skeletonAnimator: Animator? = null

        private fun stopSkeletonAnim() {
            skeletonAnimator?.cancel()
            skeletonAnimator = null
            binding.coverImageView.alpha = 1f
            binding.songNameTextView.alpha = 1f
            binding.singerTextView.alpha = 1f
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
            val artist = ObjectAnimator.ofFloat(binding.singerTextView, View.ALPHA, 0.35f, 0.85f).apply {
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

        fun bind(item: RecommendSongInfo) {
            stopSkeletonAnim()
            val song = item.convertToSongInfo()
            binding.coverImageView.alpha = 1f
            binding.songNameTextView.alpha = 1f
            binding.songNameTextView.background = null
            binding.singerTextView.alpha = 1f
            binding.singerTextView.background = null
            itemBinder.bind(
                song = song,
                displayTitle = item.songname,
                displayArtist = item.author_name,
                liked = isLiked(song),
                options = SongListItemOptions(),
                playbackState = playbackStateDelegate.state,
                actions = SongListItemActions(
                    onClick = { dispatchAtCurrentPosition(item, onItemClick) },
                    onDownloadClick = { dispatchAtCurrentPosition(item, onDownloadClick) },
                    onLoveClick = { dispatchAtCurrentPosition(item, onLoveClick) },
                    onMoreClick = { dispatchAtCurrentPosition(item, onMoreClick) },
                ),
            )
        }

        private fun dispatchAtCurrentPosition(
            item: RecommendSongInfo,
            action: (RecommendSongInfo, Int) -> Unit,
        ) {
            val position = bindingAdapterPosition
            if (position != RecyclerView.NO_POSITION) action(item, position)
        }

        fun bindSkeleton() {
            startSkeletonAnim()
            binding.root.alpha = 1f
            binding.coverImageView.setImageResource(R.drawable.ic_pm_icon)
            binding.coverImageView.alpha = 0.25f
            binding.currentSongCoverMask.visibility = View.GONE
            binding.playingSpectrumView.setPlaybackState(selected = false, isPlaying = false)
            binding.songNameTextView.text = ""
            binding.songNameTextView.setBackgroundResource(R.drawable.bg_skeleton_rounded)
            binding.singerTextView.text = ""
            binding.singerTextView.setBackgroundResource(R.drawable.bg_skeleton_rounded)
            binding.songSourceTagTextView.visibility = View.GONE
            binding.btnDownload.visibility = View.VISIBLE
            binding.btnLove.visibility = View.VISIBLE
            binding.btnMore.visibility = View.VISIBLE
            binding.btnDownload.alpha = 0.2f
            binding.btnLove.alpha = 0.2f
            binding.btnMore.alpha = 0.2f
            binding.root.setOnClickListener(null)
            binding.btnDownload.setOnClickListener(null)
            binding.btnLove.setOnClickListener(null)
            binding.btnMore.setOnClickListener(null)
        }

        fun recycle() {
            stopSkeletonAnim()
            binding.playingSpectrumView.setPlaybackState(selected = false, isPlaying = false)
        }
    }

    fun refreshLoveStates() {
        notifyDataSetChanged()
    }

    override fun updatePlaybackState(state: SongListPlaybackState) {
        playbackStateDelegate.updatePlaybackState(state)
    }

    private fun indexOfSong(song: SongInfo): Int = currentList.indexOfFirst { item ->
        val candidate = item.convertToSongInfo()
        candidate.type == song.type && candidate.id == song.id
    }

    private object Diff : DiffUtil.ItemCallback<RecommendSongInfo>() {
        override fun areItemsTheSame(a: RecommendSongInfo, b: RecommendSongInfo) =
            a.hash == b.hash && a.sourceType == b.sourceType

        override fun areContentsTheSame(a: RecommendSongInfo, b: RecommendSongInfo) = a == b
    }
}
