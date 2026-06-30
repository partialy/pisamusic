package cn.partialy.pm.ui.local.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemLocalMusicEditRowBinding
import cn.partialy.pm.utils.LocalMusicMediaRow

class LocalMusicEditAdapter(
    private val selectedIds: MutableSet<String>,
    private val onSelectionChanged: () -> Unit,
) : RecyclerView.Adapter<LocalMusicEditAdapter.VH>() {

    private val items = mutableListOf<LocalMusicMediaRow>()

    fun submitList(rows: List<LocalMusicMediaRow>, clearSelection: Boolean = true) {
        items.clear()
        items.addAll(rows)
        if (clearSelection) {
            selectedIds.clear()
        }
        notifyDataSetChanged()
        onSelectionChanged()
    }

    fun currentRows(): List<LocalMusicMediaRow> = items.toList()

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
            val checked = selectedIds.contains(row.recordId)
            binding.checkBox.isChecked = checked
            val toggle = {
                if (selectedIds.contains(row.recordId)) {
                    selectedIds.remove(row.recordId)
                } else {
                    selectedIds.add(row.recordId)
                }
                binding.checkBox.isChecked = selectedIds.contains(row.recordId)
                onSelectionChanged()
            }
            binding.root.setOnClickListener { toggle() }
        }
    }
}
