package cn.partialy.pm.ui.mine

import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.core.graphics.ColorUtils
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemThirdPartyPlaylistImportBinding
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.cookie.MusicCookieManager
import cn.partialy.pm.network.cookie.ThirdPartyPlaylistCandidate
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import coil.load

class ThirdPartyPlaylistImportAdapter(
    private val onToggleCandidate: (ThirdPartyPlaylistCandidate) -> Unit,
) : ListAdapter<ThirdPartyPlaylistCandidateRow, ThirdPartyPlaylistImportAdapter.ViewHolder>(Diff) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder =
        ViewHolder(
            ItemThirdPartyPlaylistImportBinding.inflate(
                LayoutInflater.from(parent.context),
                parent,
                false,
            ),
            onToggleCandidate,
        )

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(
        private val binding: ItemThirdPartyPlaylistImportBinding,
        private val onToggleCandidate: (ThirdPartyPlaylistCandidate) -> Unit,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(row: ThirdPartyPlaylistCandidateRow) {
            val item = row.candidate
            val ctx = binding.root.context
            binding.titleTextView.text = item.name

            val songType = when (item.source.lowercase()) {
                MusicCookieManager.SOURCE_KG -> SongType.KG
                MusicCookieManager.SOURCE_WY -> SongType.WY
                else -> null
            }
            if (songType != null) {
                SongSourceTagBinder.bind(binding.sourceTagView, songType)
            } else {
                SongSourceTagBinder.hide(binding.sourceTagView)
            }

            val countText = ctx.getString(R.string.mine_playlist_track_count, item.songCount.coerceAtLeast(0))
            val intro = item.intro.trim()
            binding.metaTextView.text = if (intro.isNotEmpty()) "$countText · $intro" else countText

            bindCover(item)
            bindSelectionAndBadge(row)

            binding.selectionCheckBox.setOnCheckedChangeListener(null)
            binding.selectionCheckBox.isChecked = row.imported || row.selected
            binding.selectionCheckBox.isEnabled = !row.imported
            binding.selectionCheckBox.isClickable = !row.imported

            binding.root.alpha = if (row.imported) 0.65f else 1f
            binding.root.isClickable = !row.imported
            binding.root.setOnClickListener {
                if (!row.imported) onToggleCandidate(item)
            }
            binding.selectionCheckBox.setOnClickListener {
                if (!row.imported) onToggleCandidate(item)
            }
        }

        private fun bindSelectionAndBadge(row: ThirdPartyPlaylistCandidateRow) {
            val ctx = binding.root.context
            val badge = binding.statusBadgeView
            when {
                row.imported -> {
                    val fg = ContextCompat.getColor(ctx, R.color.home_tab_unselected)
                    badge.visibility = View.VISIBLE
                    badge.setText(R.string.third_party_import_badge_imported)
                    badge.setTextColor(fg)
                    badge.background = GradientDrawable().apply {
                        shape = GradientDrawable.RECTANGLE
                        cornerRadius = ctx.resources.displayMetrics.density * 10f
                        setColor(ColorUtils.setAlphaComponent(fg, 28))
                    }
                }
                row.selected -> {
                    val fg = ContextCompat.getColor(ctx, R.color.blue_selected)
                    badge.visibility = View.VISIBLE
                    badge.setText(R.string.third_party_import_badge_selected)
                    badge.setTextColor(fg)
                    badge.background = GradientDrawable().apply {
                        shape = GradientDrawable.RECTANGLE
                        cornerRadius = ctx.resources.displayMetrics.density * 10f
                        setColor(ColorUtils.setAlphaComponent(fg, 32))
                    }
                }
                else -> {
                    badge.visibility = View.GONE
                }
            }
        }

        private fun bindCover(item: ThirdPartyPlaylistCandidate) {
            val fallback = MinePlaylistCoverResolver.fallbackCoverRes
            val url = SongCoverUrl.getRemoteCover(item.source, item.cover, SongCoverUrl.SIZE_MEDIUM)
            if (url.startsWith("https://") || url.startsWith("http://")) {
                binding.coverImageView.load(url) {
                    crossfade(true)
                    placeholder(fallback)
                    error(fallback)
                }
            } else {
                binding.coverImageView.setImageResource(fallback)
            }
        }
    }

    private object Diff : DiffUtil.ItemCallback<ThirdPartyPlaylistCandidateRow>() {
        override fun areItemsTheSame(
            oldItem: ThirdPartyPlaylistCandidateRow,
            newItem: ThirdPartyPlaylistCandidateRow,
        ): Boolean = oldItem.candidate.key() == newItem.candidate.key()

        override fun areContentsTheSame(
            oldItem: ThirdPartyPlaylistCandidateRow,
            newItem: ThirdPartyPlaylistCandidateRow,
        ): Boolean = oldItem == newItem
    }
}
