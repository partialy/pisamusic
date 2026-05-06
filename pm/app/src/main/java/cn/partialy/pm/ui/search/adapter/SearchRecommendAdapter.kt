package cn.partialy.pm.ui.search.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemSearchRecommendBinding
import cn.partialy.pm.model.HotSearchInfo

/**
 * Two-column grid of flattened hot-search keywords (猜你喜欢).
 */
class SearchRecommendAdapter(
    private val onKeywordClick: (String) -> Unit,
) : ListAdapter<String, SearchRecommendAdapter.ViewHolder>(DiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSearchRecommendBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false,
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(
        private val binding: ItemSearchRecommendBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(keyword: String) {
            binding.keywordTextView.text = keyword
            binding.root.setOnClickListener { onKeywordClick(keyword) }
        }
    }

    private object DiffCallback : DiffUtil.ItemCallback<String>() {
        override fun areItemsTheSame(oldItem: String, newItem: String): Boolean = oldItem == newItem
        override fun areContentsTheSame(oldItem: String, newItem: String): Boolean = oldItem == newItem
    }

    companion object {
        fun flattenKeywords(list: List<HotSearchInfo>): List<String> =
            list.flatMap { info -> info.keywords.map { it.keyword } }.distinct()
    }
}
