package cn.partialy.pm.ui.local.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemLocalMusicScanResultBinding
import cn.partialy.pm.utils.LocalSongScanCandidate

class LocalMusicScanResultAdapter(
    private val selectedKeys: MutableSet<String>,
    private val onSelectionChanged: () -> Unit,
) : RecyclerView.Adapter<LocalMusicScanResultAdapter.VH>() {

    private val items = mutableListOf<LocalSongScanCandidate>()

    fun submitList(candidates: List<LocalSongScanCandidate>) {
        items.clear()
        items.addAll(candidates)
        selectedKeys.clear()
        selectedKeys.addAll(candidates.filterNot { it.isExisting }.map { it.scanKey })
        notifyDataSetChanged()
        onSelectionChanged()
    }

    fun selectedCandidates(): List<LocalSongScanCandidate> =
        items.filter { it.scanKey in selectedKeys && !it.isExisting }

    override fun getItemCount(): Int = items.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemLocalMusicScanResultBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false,
        )
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(items[position])
    }

    inner class VH(
        private val binding: ItemLocalMusicScanResultBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(candidate: LocalSongScanCandidate) {
            val context = binding.root.context
            val checked = candidate.scanKey in selectedKeys
            binding.titleTextView.text = candidate.title.ifBlank {
                candidate.displayName.ifBlank { context.getString(R.string.unknown_media_title) }
            }
            binding.artistTextView.text = buildSubtitle(candidate)
            binding.existingTextView.isVisible = candidate.isExisting
            binding.checkBox.isEnabled = !candidate.isExisting
            binding.checkBox.isChecked = checked && !candidate.isExisting
            binding.root.alpha = if (candidate.isExisting) 0.58f else 1f
            binding.root.setOnClickListener {
                if (candidate.isExisting) return@setOnClickListener
                val position = bindingAdapterPosition
                if (position == RecyclerView.NO_POSITION) return@setOnClickListener
                if (candidate.scanKey in selectedKeys) {
                    selectedKeys.remove(candidate.scanKey)
                } else {
                    selectedKeys.add(candidate.scanKey)
                }
                notifyItemChanged(position)
                onSelectionChanged()
            }
        }

        private fun buildSubtitle(candidate: LocalSongScanCandidate): String {
            val context = binding.root.context
            val artist = candidate.artist.ifBlank {
                context.getString(R.string.local_music_scan_unknown_artist)
            }
            val duration = candidate.duration?.let(::formatDuration)
            return listOfNotNull(artist, duration).joinToString(
                binding.root.context.getString(R.string.common_separator_dot),
            )
        }

        private fun formatDuration(durationMs: Long): String {
            val totalSeconds = (durationMs / 1000).coerceAtLeast(0)
            val minutes = totalSeconds / 60
            val seconds = totalSeconds % 60
            return "%d:%02d".format(minutes, seconds)
        }
    }
}
