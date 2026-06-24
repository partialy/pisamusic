package cn.partialy.pm.ui.settings

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemSubSettingsOptionBinding
import cn.partialy.pm.databinding.ItemSubSettingsSectionBinding
import cn.partialy.pm.databinding.ItemSubSettingsSwitchBinding

class SubSettingsAdapter(
    private val onItemClick: (SubSettingsItem) -> Unit,
    private val onSwitchChanged: (SubSettingsItem.Switch, Boolean) -> Unit,
) : ListAdapter<SubSettingsSection, SubSettingsAdapter.SectionViewHolder>(DIFF_CALLBACK) {

    init {
        setHasStableIds(true)
    }

    override fun getItemId(position: Int): Long = getItem(position).id.hashCode().toLong()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SectionViewHolder {
        val binding = ItemSubSettingsSectionBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false,
        )
        return SectionViewHolder(binding)
    }

    override fun onBindViewHolder(holder: SectionViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class SectionViewHolder(
        private val binding: ItemSubSettingsSectionBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(section: SubSettingsSection) {
            binding.sectionTitle.apply {
                text = section.title
                visibility = if (section.title.isNullOrEmpty()) View.GONE else View.VISIBLE
            }
            binding.sectionItems.removeAllViews()
            section.items.forEachIndexed { index, item ->
                if (index > 0) binding.sectionItems.addView(createDivider(binding.sectionItems))
                binding.sectionItems.addView(createItemView(binding.sectionItems, item))
            }
        }

        private fun createItemView(parent: ViewGroup, item: SubSettingsItem): View = when (item) {
            is SubSettingsItem.Option -> createOptionView(parent, item, item.value)
            is SubSettingsItem.Navigation -> createOptionView(parent, item, null)
            is SubSettingsItem.Switch -> createSwitchView(parent, item)
        }

        private fun createOptionView(
            parent: ViewGroup,
            item: SubSettingsItem,
            value: CharSequence?,
        ): View {
            val row = ItemSubSettingsOptionBinding.inflate(
                LayoutInflater.from(parent.context),
                parent,
                false,
            )
            row.titleTextView.text = item.title
            bindOptionalText(row.summaryTextView, item.summary)
            bindOptionalText(row.valueTextView, value)
            row.root.isEnabled = item.enabled
            row.root.alpha = if (item.enabled) 1f else DISABLED_ALPHA
            row.root.setOnClickListener { if (item.enabled) onItemClick(item) }
            return row.root
        }

        private fun createSwitchView(parent: ViewGroup, item: SubSettingsItem.Switch): View {
            val row = ItemSubSettingsSwitchBinding.inflate(
                LayoutInflater.from(parent.context),
                parent,
                false,
            )
            row.titleTextView.text = item.title
            bindOptionalText(row.summaryTextView, item.summary)
            row.switchView.isChecked = item.checked
            row.switchView.isEnabled = item.enabled
            row.root.isEnabled = item.enabled
            row.root.alpha = if (item.enabled) 1f else DISABLED_ALPHA
            row.root.setOnClickListener {
                if (item.enabled) row.switchView.toggle()
            }
            row.switchView.setOnCheckedChangeListener { _, checked ->
                if (item.enabled && checked != item.checked) onSwitchChanged(item, checked)
            }
            return row.root
        }

        private fun bindOptionalText(view: android.widget.TextView, value: CharSequence?) {
            view.text = value ?: ""
            view.visibility = if (value.isNullOrEmpty()) View.GONE else View.VISIBLE
        }

        private fun createDivider(parent: ViewGroup): View = View(parent.context).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                parent.resources.getDimensionPixelSize(R.dimen.sub_settings_divider_height),
            ).apply {
                marginStart = parent.resources.getDimensionPixelSize(R.dimen.sub_settings_row_horizontal_padding)
            }
            setBackgroundResource(R.color.settings_card_inset_divider)
        }
    }

    private companion object {
        private const val DISABLED_ALPHA = 0.45f

        val DIFF_CALLBACK = object : DiffUtil.ItemCallback<SubSettingsSection>() {
            override fun areItemsTheSame(
                oldItem: SubSettingsSection,
                newItem: SubSettingsSection,
            ): Boolean = oldItem.id == newItem.id

            override fun areContentsTheSame(
                oldItem: SubSettingsSection,
                newItem: SubSettingsSection,
            ): Boolean = oldItem == newItem
        }
    }
}
