package cn.partialy.pm.ui.mine

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemDialogLocalCoverThumbBinding

class CreateLocalPlaylistCoverPickerAdapter(
    private val templates: List<MinePlaylistCoverResolver.LocalCoverTemplate> =
        MinePlaylistCoverResolver.localCoverTemplates,
) : RecyclerView.Adapter<CreateLocalPlaylistCoverPickerAdapter.Vh>() {

    /** 用户点选内置模板时回调（用于取消相册待选图）。 */
    var onTemplateSelected: (() -> Unit)? = null

    var selectedPosition: Int = 0
        private set

    val selectedSuffix: String
        get() = templates.getOrNull(selectedPosition)?.suffix ?: "chill"

    override fun getItemCount(): Int = templates.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Vh {
        val binding = ItemDialogLocalCoverThumbBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return Vh(binding)
    }

    override fun onBindViewHolder(holder: Vh, position: Int) {
        holder.bind(templates[position], position == selectedPosition) {
            onTemplateSelected?.invoke()
            val old = selectedPosition
            if (position == old) return@bind
            selectedPosition = position
            notifyItemChanged(old)
            notifyItemChanged(position)
        }
    }

    class Vh(
        private val binding: ItemDialogLocalCoverThumbBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(
            template: MinePlaylistCoverResolver.LocalCoverTemplate,
            selected: Boolean,
            onClick: () -> Unit,
        ) {
            binding.thumbImageView.setImageResource(template.drawableRes)
            val bg = if (selected) {
                R.drawable.bg_local_cover_thumb_selected
            } else {
                R.drawable.bg_local_cover_thumb_unselected
            }
            binding.root.background = ContextCompat.getDrawable(binding.root.context, bg)
            binding.root.setOnClickListener { onClick() }
        }
    }
}
