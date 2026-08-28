package cn.partialy.pm.ui.home.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemHomeFeatureCardBinding
import java.util.Calendar

enum class HomeFeatureCardKind {
    CLOUD_MUSIC,
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
            val (imageRes, titleRes, subtitleRes) = when (item.kind) {
                HomeFeatureCardKind.CLOUD_MUSIC -> Triple(
                    R.drawable.home_feature_cloud_music,
                    R.string.home_feature_cloud_title,
                    R.string.home_feature_cloud_subtitle,
                )
                HomeFeatureCardKind.DAILY_RECOMMEND -> Triple(
                    R.drawable.home_feature_daily_recommend,
                    R.string.home_feature_daily_title,
                    R.string.home_feature_daily_subtitle,
                )
                HomeFeatureCardKind.RADAR_PLAYLIST -> Triple(
                    R.drawable.home_feature_radar_playlist,
                    R.string.home_feature_radar_title,
                    R.string.home_feature_radar_subtitle,
                )
            }
            val context = binding.root.context
            val title = context.getString(titleRes)
            val subtitle = context.getString(subtitleRes)
            binding.cardImage.setImageResource(imageRes)
            binding.cardTitle.text = title
            binding.cardSubtitle.text = subtitle
            binding.root.contentDescription = "$title，$subtitle"
            if (item.kind == HomeFeatureCardKind.DAILY_RECOMMEND) {
                binding.dailyDateLabel.visibility = View.VISIBLE
                binding.dailyDateLabel.text = formatDailyDate()
            } else {
                binding.dailyDateLabel.visibility = View.GONE
                binding.dailyDateLabel.text = null
            }
            binding.root.setOnClickListener { onCardClick(item.kind) }
        }

        private fun formatDailyDate(): String {
            val calendar = Calendar.getInstance()
            val weekLabel = when (calendar.get(Calendar.DAY_OF_WEEK)) {
                Calendar.MONDAY -> "周一"
                Calendar.TUESDAY -> "周二"
                Calendar.WEDNESDAY -> "周三"
                Calendar.THURSDAY -> "周四"
                Calendar.FRIDAY -> "周五"
                Calendar.SATURDAY -> "周六"
                Calendar.SUNDAY -> "周日"
                else -> error("Unexpected day of week")
            }
            return "${calendar.get(Calendar.MONTH) + 1}-${calendar.get(Calendar.DAY_OF_MONTH)} $weekLabel"
        }
    }

    private object Diff : DiffUtil.ItemCallback<HomeFeatureCardItem>() {
        override fun areItemsTheSame(a: HomeFeatureCardItem, b: HomeFeatureCardItem) = a.kind == b.kind
        override fun areContentsTheSame(a: HomeFeatureCardItem, b: HomeFeatureCardItem) = a == b
    }
}
