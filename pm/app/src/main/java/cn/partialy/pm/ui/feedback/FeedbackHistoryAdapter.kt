package cn.partialy.pm.ui.feedback

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemFeedbackHistoryBinding
import cn.partialy.pm.databinding.ItemPlaylistDetailStatusBinding
import cn.partialy.pm.feedback.FeedbackFormatters
import cn.partialy.pm.feedback.FeedbackHistoryItemDto
import coil.load

class FeedbackHistoryAdapter(
    private val resolveImageUrl: (String?) -> String?,
    private val onItemClick: (FeedbackHistoryItemDto) -> Unit,
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    enum class FooterState {
        HIDDEN,
        LOADING,
        NO_MORE,
    }

    private val items = mutableListOf<FeedbackHistoryItemDto>()
    private var footerState: FooterState = FooterState.HIDDEN

    fun submitItems(newItems: List<FeedbackHistoryItemDto>, newFooterState: FooterState) {
        items.clear()
        items.addAll(newItems)
        footerState = newFooterState
        notifyDataSetChanged()
    }

    fun setFooterState(newFooterState: FooterState) {
        if (footerState == newFooterState) return
        footerState = newFooterState
        notifyDataSetChanged()
    }

    override fun getItemCount(): Int {
        if (items.isEmpty()) return 0
        return items.size + if (footerState == FooterState.HIDDEN) 0 else 1
    }

    override fun getItemViewType(position: Int): Int {
        return if (position < items.size) VIEW_TYPE_ITEM else VIEW_TYPE_FOOTER
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == VIEW_TYPE_ITEM) {
            ItemViewHolder(
                ItemFeedbackHistoryBinding.inflate(inflater, parent, false),
                resolveImageUrl,
                onItemClick,
            )
        } else {
            FooterViewHolder(ItemPlaylistDetailStatusBinding.inflate(inflater, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (holder) {
            is ItemViewHolder -> holder.bind(items[position])
            is FooterViewHolder -> holder.bind(footerState)
        }
    }

    class ItemViewHolder(
        private val binding: ItemFeedbackHistoryBinding,
        private val resolveImageUrl: (String?) -> String?,
        private val onItemClick: (FeedbackHistoryItemDto) -> Unit,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: FeedbackHistoryItemDto) = with(binding) {
            val context = root.context
            feedbackTypeTextView.text = FeedbackFormatters.typeLabel(context, item.feedbackType)
            feedbackDescTextView.text = item.description
            feedbackTimeTextView.text = FeedbackFormatters.formatListTime(item.createdAt)
            feedbackPlaceholderIcon.setImageResource(FeedbackFormatters.typeIconRes(item.feedbackType))

            val thumbUrl = resolveImageUrl(item.firstImageUrl ?: item.images.firstOrNull())
            if (thumbUrl != null) {
                feedbackThumbnailImageView.visibility = View.VISIBLE
                feedbackPlaceholderContainer.visibility = View.VISIBLE
                feedbackThumbnailImageView.load(thumbUrl) {
                    crossfade(true)
                    listener(
                        onError = { _, _ ->
                            feedbackThumbnailImageView.visibility = View.GONE
                        },
                    )
                }
            } else {
                feedbackThumbnailImageView.setImageDrawable(null)
                feedbackThumbnailImageView.visibility = View.GONE
                feedbackPlaceholderContainer.visibility = View.VISIBLE
            }

            val processed = FeedbackFormatters.isProcessed(item.status)
            feedbackStatusPillTextView.text = FeedbackFormatters.statusLabel(context, item.status)
            feedbackStatusPillTextView.setBackgroundResource(
                if (processed) R.drawable.bg_feedback_status_pill_processed
                else R.drawable.bg_feedback_status_pill_pending,
            )
            feedbackStatusPillTextView.setTextColor(
                ContextCompat.getColor(
                    context,
                    if (processed) R.color.feedback_status_processed
                    else R.color.feedback_status_pending,
                ),
            )

            root.setOnClickListener { onItemClick(item) }
        }
    }

    class FooterViewHolder(
        private val binding: ItemPlaylistDetailStatusBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(state: FooterState) = with(binding) {
            when (state) {
                FooterState.LOADING -> {
                    statusProgressBar.visibility = View.VISIBLE
                    statusTextView.setText(R.string.feedback_history_loading_more)
                }
                FooterState.NO_MORE -> {
                    statusProgressBar.visibility = View.GONE
                    statusTextView.setText(R.string.feedback_history_no_more)
                }
                FooterState.HIDDEN -> {
                    statusProgressBar.visibility = View.GONE
                    statusTextView.text = ""
                }
            }
        }
    }

    companion object {
        private const val VIEW_TYPE_ITEM = 0
        private const val VIEW_TYPE_FOOTER = 1
    }
}
