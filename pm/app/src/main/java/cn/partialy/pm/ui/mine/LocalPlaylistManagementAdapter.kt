package cn.partialy.pm.ui.mine

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemLocalPlaylistManagementBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.utils.SongCoverUrl
import coil.load

class LocalPlaylistManagementAdapter(
    private val onSelectionChanged: (CollectedPlaylist, Boolean) -> Unit,
) : RecyclerView.Adapter<LocalPlaylistManagementAdapter.ViewHolder>() {

    private var playlists: List<CollectedPlaylist> = emptyList()
    private var selectedIds: Set<String> = emptySet()

    fun submit(playlists: List<CollectedPlaylist>, selectedIds: Set<String>) {
        this.playlists = playlists
        this.selectedIds = selectedIds
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder =
        ViewHolder(
            ItemLocalPlaylistManagementBinding.inflate(
                LayoutInflater.from(parent.context),
                parent,
                false,
            ),
            onSelectionChanged,
        )

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(playlists[position], playlists[position].id in selectedIds)
    }

    override fun getItemCount(): Int = playlists.size

    class ViewHolder(
        private val binding: ItemLocalPlaylistManagementBinding,
        private val onSelectionChanged: (CollectedPlaylist, Boolean) -> Unit,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: CollectedPlaylist, selected: Boolean) {
            binding.titleTextView.text = item.name
            binding.trackCountTextView.text = binding.root.context.getString(
                R.string.mine_playlist_track_count,
                item.count.coerceAtLeast(0),
            )
            binding.selectionCheckBox.setOnCheckedChangeListener(null)
            binding.selectionCheckBox.isChecked = selected
            binding.selectionCheckBox.setOnCheckedChangeListener { _, checked ->
                onSelectionChanged(item, checked)
            }
            binding.root.setOnClickListener {
                binding.selectionCheckBox.isChecked = !binding.selectionCheckBox.isChecked
            }
            bindCover(item)
        }

        private fun bindCover(item: CollectedPlaylist) {
            val imageView = binding.coverImageView
            MinePlaylistCoverResolver.localTemplateRes(item.cover)?.let { res ->
                imageView.setImageResource(res)
                return
            }
            MinePlaylistCoverResolver.localFileForCover(item.cover)?.let { file ->
                val placeholder = MinePlaylistCoverResolver.defaultLocalCoverRes()
                imageView.load(file) {
                    crossfade(true)
                    placeholder(placeholder)
                    error(placeholder)
                }
                return
            }
            val fallback = MinePlaylistCoverResolver.defaultLocalCoverRes()
            val url = SongCoverUrl.getRemoteCover("", item.cover, SongCoverUrl.SIZE_MEDIUM)
            if (url.startsWith("https://") || url.startsWith("http://")) {
                imageView.load(url) {
                    placeholder(fallback)
                    error(fallback)
                }
            } else {
                imageView.setImageResource(fallback)
            }
        }
    }
}
