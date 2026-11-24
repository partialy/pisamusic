package cn.partialy.pm.ui.mine

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemThirdPartyPlaylistImportBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.toCanonicalSource
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import coil.load

data class PlaylistManagementRow(val playlist: CollectedPlaylist, val selected: Boolean, val enabled: Boolean)

/** 复用导入页行布局，收藏歌单始终可选，不显示“已导入”状态。 */
class PlaylistManagementAdapter(private val onToggle: (CollectedPlaylist) -> Unit) :
    ListAdapter<PlaylistManagementRow, PlaylistManagementAdapter.Holder>(Diff) {
    init { stateRestorationPolicy = StateRestorationPolicy.PREVENT_WHEN_EMPTY }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder = Holder(
        ItemThirdPartyPlaylistImportBinding.inflate(LayoutInflater.from(parent.context), parent, false),
    )

    override fun onBindViewHolder(holder: Holder, position: Int) = holder.bind(getItem(position))

    inner class Holder(private val binding: ItemThirdPartyPlaylistImportBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(row: PlaylistManagementRow) {
            val item = row.playlist
            val source = item.type.toCanonicalSource()
            binding.titleTextView.text = item.name
            SongSourceTagBinder.bind(binding.sourceTagView, if (source == "kg") SongType.KG else SongType.WY)
            val count = binding.root.context.getString(R.string.mine_playlist_track_count, item.count.coerceAtLeast(0))
            binding.metaTextView.text = item.intro.trim().let { if (it.isEmpty()) count else "$count · $it" }
            binding.statusBadgeView.visibility = View.GONE
            binding.selectionCheckBox.setOnCheckedChangeListener(null)
            binding.selectionCheckBox.isChecked = row.selected
            binding.selectionCheckBox.isEnabled = row.enabled
            binding.root.isEnabled = row.enabled
            binding.root.setOnClickListener { if (row.enabled) onToggle(item) }
            binding.selectionCheckBox.setOnClickListener { if (row.enabled) onToggle(item) }
            val fallback = MinePlaylistCoverResolver.fallbackCoverRes
            val url = SongCoverUrl.getRemoteCover(source, item.cover, SongCoverUrl.SIZE_MEDIUM)
            binding.coverImageView.load(url.takeIf { it.startsWith("https://") || it.startsWith("http://") }) {
                placeholder(fallback)
                error(fallback)
                fallback(fallback)
            }
        }
    }

    private object Diff : DiffUtil.ItemCallback<PlaylistManagementRow>() {
        override fun areItemsTheSame(oldItem: PlaylistManagementRow, newItem: PlaylistManagementRow) =
            oldItem.playlist.managementKey() == newItem.playlist.managementKey()
        override fun areContentsTheSame(oldItem: PlaylistManagementRow, newItem: PlaylistManagementRow) = oldItem == newItem
    }
}
