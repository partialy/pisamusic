package cn.partialy.pm.ui.search.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.databinding.ItemHotSearchBinding
import cn.partialy.pm.model.HotSearchInfo

/**
 * 热门搜索适配器
 * @param onItemClick 点击热门搜索项的回调函数
 */
class HotSearchAdapter(
    private val onItemClick: (String) -> Unit
) : ListAdapter<HotSearchInfo, HotSearchAdapter.ViewHolder>(HotSearchDiffCallback()) {

    /**
     * ViewHolder 用于缓存视图
     */
    inner class ViewHolder(
        private val binding: ItemHotSearchBinding
    ) : RecyclerView.ViewHolder(binding.root) {
        
        /**
         * 绑定数据到视图
         * @param hotSearch 热门搜索数据
         */
        fun bind(hotSearch: HotSearchInfo) {
            binding.apply {
                keywordTextView.text = hotSearch.keywords[0].keyword
                root.setOnClickListener {
                    onItemClick(hotSearch.keywords[0].keyword)
                }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemHotSearchBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }
}

/**
 * DiffUtil回调类，用于计算列表差异
 */
private class HotSearchDiffCallback : DiffUtil.ItemCallback<HotSearchInfo>() {
    override fun areItemsTheSame(oldItem: HotSearchInfo, newItem: HotSearchInfo): Boolean {
        return oldItem.name == newItem.name
    }

    override fun areContentsTheSame(oldItem: HotSearchInfo, newItem: HotSearchInfo): Boolean {
        return oldItem == newItem
    }
} 