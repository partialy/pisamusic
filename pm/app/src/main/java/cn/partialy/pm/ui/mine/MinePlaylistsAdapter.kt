package cn.partialy.pm.ui.mine

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.LocalPlaylistDetailActivity
import cn.partialy.pm.activity.PlaylistDetailActivity
import cn.partialy.pm.activity.WyPlaylistDetailActivity
import cn.partialy.pm.databinding.ItemMinePlaylistRowBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import coil.load

class MinePlaylistsAdapter(
    private val onMoreClick: (CollectedPlaylist) -> Unit,
) : ListAdapter<CollectedPlaylist, MinePlaylistsAdapter.Vh>(Diff) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Vh {
        val binding = ItemMinePlaylistRowBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return Vh(binding, onMoreClick)
    }

    override fun onBindViewHolder(holder: Vh, position: Int) {
        holder.bind(getItem(position))
    }

    class Vh(
        private val binding: ItemMinePlaylistRowBinding,
        private val onMoreClick: (CollectedPlaylist) -> Unit,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: CollectedPlaylist) {
            binding.titleTextView.text = item.name
            val intro = item.intro.trim()
            if (intro.isNotEmpty()) {
                binding.descTextView.text = intro
                binding.descTextView.visibility = android.view.View.VISIBLE
            } else {
                binding.descTextView.visibility = android.view.View.GONE
            }
            val n = item.count.coerceAtLeast(0)
            val ctx = binding.root.context
            binding.trackCountTextView.text = ctx.getString(R.string.mine_playlist_track_count, n)

            bindCover(item)

            binding.root.setOnClickListener {
                when (item.type) {
                    CollectedPlaylistType.KG, CollectedPlaylistType.IMPORT_KG ->
                        if (item.id.startsWith("collection_")) {
                            val label =
                                if (n > 0) ctx.getString(R.string.mine_playlist_track_count, n) else "—"
                            PlaylistDetailActivity.start(
                                ctx,
                                playlistId = item.id,
                                title = item.name,
                                coverUrl = item.cover,
                                playCountLabel = label,
                            )
                        }
                    CollectedPlaylistType.LOCAL ->
                        LocalPlaylistDetailActivity.start(ctx, item.id)
                    CollectedPlaylistType.WY, CollectedPlaylistType.IMPORT_WY -> {
                        val label =
                            if (n > 0) ctx.getString(R.string.mine_playlist_track_count, n) else "—"
                        WyPlaylistDetailActivity.start(
                            ctx,
                            playlistId = item.id,
                            title = item.name,
                            coverUrl = item.cover,
                            playCountLabel = label,
                            trackCount = n,
                            storageType = item.type,
                        )
                    }
                }
            }

            binding.moreButton.setOnClickListener { onMoreClick(item) }
        }

        private fun bindCover(item: CollectedPlaylist) {
            val iv = binding.coverImageView
            MinePlaylistCoverResolver.localTemplateRes(item.cover)?.let { res ->
                iv.setImageResource(res)
                return
            }
            MinePlaylistCoverResolver.localFileForCover(item.cover)?.let { file ->
                val ph = MinePlaylistCoverResolver.defaultLocalCoverRes()
                iv.load(file) {
                    crossfade(true)
                    placeholder(ph)
                    error(ph)
                }
                return
            }
            val url = item.cover.trim()
            if (url.startsWith("http://") || url.startsWith("https://")) {
                iv.load(url) {
                    placeholder(MinePlaylistCoverResolver.fallbackCoverRes)
                    error(MinePlaylistCoverResolver.fallbackCoverRes)
                }
            } else {
                iv.setImageResource(
                    if (item.type == CollectedPlaylistType.LOCAL) {
                        MinePlaylistCoverResolver.defaultLocalCoverRes()
                    } else {
                        MinePlaylistCoverResolver.fallbackCoverRes
                    },
                )
            }
        }
    }

    private object Diff : DiffUtil.ItemCallback<CollectedPlaylist>() {
        override fun areItemsTheSame(a: CollectedPlaylist, b: CollectedPlaylist) =
            a.type == b.type && a.id == b.id

        override fun areContentsTheSame(a: CollectedPlaylist, b: CollectedPlaylist) = a == b
    }
}
