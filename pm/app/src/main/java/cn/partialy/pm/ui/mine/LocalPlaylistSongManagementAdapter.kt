package cn.partialy.pm.ui.mine

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemLocalPlaylistSongManagementBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.SongCoverUrl
import coil.load

class LocalPlaylistSongManagementAdapter(
    private val onSelectionChanged: (SongInfo, Boolean) -> Unit,
) : RecyclerView.Adapter<LocalPlaylistSongManagementAdapter.ViewHolder>() {

    private var songs: List<SongInfo> = emptyList()
    private var selectedKeys: Set<String> = emptySet()

    fun submit(songs: List<SongInfo>, selectedKeys: Set<String>) {
        this.songs = songs
        this.selectedKeys = selectedKeys
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder =
        ViewHolder(
            ItemLocalPlaylistSongManagementBinding.inflate(
                LayoutInflater.from(parent.context),
                parent,
                false,
            ),
            onSelectionChanged,
        )

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val song = songs[position]
        holder.bind(song, playlistSongKey(song) in selectedKeys)
    }

    override fun getItemCount(): Int = songs.size

    class ViewHolder(
        private val binding: ItemLocalPlaylistSongManagementBinding,
        private val onSelectionChanged: (SongInfo, Boolean) -> Unit,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(song: SongInfo, selected: Boolean) {
            binding.titleTextView.text = song.name
            binding.artistTextView.text = song.artist.ifBlank {
                binding.root.context.getString(R.string.local_music_scan_unknown_artist)
            }
            binding.selectionCheckBox.setOnCheckedChangeListener(null)
            binding.selectionCheckBox.isChecked = selected
            binding.selectionCheckBox.setOnCheckedChangeListener { _, checked ->
                onSelectionChanged(song, checked)
            }
            binding.root.setOnClickListener {
                binding.selectionCheckBox.isChecked = !binding.selectionCheckBox.isChecked
            }
            bindCover(song)
        }

        private fun bindCover(song: SongInfo) {
            val coverData = SongCoverUrl.getSongCoverData(song, SongCoverUrl.SIZE_SMALL)
            binding.coverImageView.load(coverData) {
                crossfade(true)
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
        }
    }
}
