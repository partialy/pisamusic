package cn.partialy.pm.ui.local.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemLocalMusicEditRowBinding
import cn.partialy.pm.utils.LocalMusicMediaRow

class LocalMusicEditAdapter(
    private val selectedIds: MutableSet<Long>,
    private val onSelectionChanged: () -> Unit,
) : RecyclerView.Adapter<LocalMusicEditAdapter.VH>() {

    private val items = mutableListOf<LocalMusicMediaRow>()

    fun submitList(rows: List<LocalMusicMediaRow>) {
        items.clear()
        items.addAll(rows)
        selectedIds.clear()
        notifyDataSetChanged()
        onSelectionChanged()
    }

    override fun getItemCount(): Int = items.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemLocalMusicEditRowBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(items[position])
    }

    inner class VH(private val binding: ItemLocalMusicEditRowBinding) : RecyclerView.ViewHolder(binding.root) {

        fun bind(row: LocalMusicMediaRow) {
            binding.titleTextView.text = row.title.ifBlank {
                binding.root.context.getString(R.string.unknown_media_title)
            }
            binding.artistTextView.text = row.artist.ifBlank { "—" }
            val checked = selectedIds.contains(row.mediaId)
            binding.checkBox.isChecked = checked
            val toggle = {
                if (selectedIds.contains(row.mediaId)) {
                    selectedIds.remove(row.mediaId)
                } else {
                    selectedIds.add(row.mediaId)
                }
                binding.checkBox.isChecked = selectedIds.contains(row.mediaId)
                onSelectionChanged()
            }
            binding.root.setOnClickListener { toggle() }
        }
    }
}
