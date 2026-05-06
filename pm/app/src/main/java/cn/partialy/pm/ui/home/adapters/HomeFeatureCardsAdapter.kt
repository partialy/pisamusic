package cn.partialy.pm.ui.home.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemHomeFeatureCardBinding

enum class HomeFeatureCardKind {
    GUESS_YOU_LIKE,
    DAILY_RECOMMEND,
    RADAR_PLAYLIST,
}

data class HomeFeatureCardItem(
    val kind: HomeFeatureCardKind,
)

class HomeFeatureCardsAdapter(
    private val onCardClick: (HomeFeatureCardKind) -> Unit,
) : ListAdapter<HomeFeatureCardItem, HomeFeatureCardsAdapter.Vh>(Diff) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Vh {
        val binding = ItemHomeFeatureCardBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return Vh(binding)
    }

    override fun onBindViewHolder(holder: Vh, position: Int) {
        holder.bind(getItem(position))
    }

    inner class Vh(
        private val binding: ItemHomeFeatureCardBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: HomeFeatureCardItem) {
            val (imageRes, descRes) = when (item.kind) {
                HomeFeatureCardKind.GUESS_YOU_LIKE -> Pair(
                    R.drawable.home_feature_guess_you_like,
                    R.string.home_feature_guess_title,
                )
                HomeFeatureCardKind.DAILY_RECOMMEND -> Pair(
                    R.drawable.home_feature_daily_recommend,
                    R.string.home_feature_daily_title,
                )
                HomeFeatureCardKind.RADAR_PLAYLIST -> Pair(
                    R.drawable.home_feature_radar_playlist,
                    R.string.home_feature_radar_title,
                )
            }
            binding.cardImage.setImageResource(imageRes)
            binding.cardImage.contentDescription = binding.root.context.getString(descRes)
            binding.cardImage.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            binding.root.setOnClickListener { onCardClick(item.kind) }
        }
    }

    private object Diff : DiffUtil.ItemCallback<HomeFeatureCardItem>() {
        override fun areItemsTheSame(a: HomeFeatureCardItem, b: HomeFeatureCardItem) = a.kind == b.kind
        override fun areContentsTheSame(a: HomeFeatureCardItem, b: HomeFeatureCardItem) = a == b
    }
}
