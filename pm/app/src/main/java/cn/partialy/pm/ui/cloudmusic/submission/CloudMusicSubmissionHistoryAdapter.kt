package cn.partialy.pm.ui.cloudmusic.submission

import android.content.res.ColorStateList
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemCloudMusicSubmissionHistoryBinding
import cn.partialy.pm.network.cloudmusic.CloudMusicTrackDto
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 投稿历史只负责展示与转发重提意图，业务状态校验仍由 ViewModel 负责。 */
class CloudMusicSubmissionHistoryAdapter(
    private val onResubmitClick: (CloudMusicTrackDto) -> Unit,
    private val onItemBound: (Int) -> Unit,
) : ListAdapter<CloudMusicTrackDto, CloudMusicSubmissionHistoryAdapter.ViewHolder>(ITEM_DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder = ViewHolder(
        ItemCloudMusicSubmissionHistoryBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false,
        ),
    )

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
        onItemBound(position)
    }

    inner class ViewHolder(
        private val binding: ItemCloudMusicSubmissionHistoryBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(track: CloudMusicTrackDto) = with(binding) {
            val context = root.context
            val status = statusPresentation(track)
            val coverModel: Any = track.cover?.url?.takeIf(String::isNotBlank) ?: R.drawable.ic_pm_icon

            submissionHistoryCover.load(coverModel) {
                crossfade(true)
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
            submissionHistoryTitle.text = track.title.ifBlank {
                context.getString(R.string.cloud_music_submission_history_unknown_title)
            }
            submissionHistoryArtist.text = context.getString(
                R.string.cloud_music_submission_history_artist_value,
                track.artist.ifBlank { context.getString(R.string.cloud_music_submission_history_unknown_value) },
            )
            submissionHistoryAlbum.text = context.getString(
                R.string.cloud_music_submission_history_album_value,
                track.album?.takeIf(String::isNotBlank)
                    ?: context.getString(R.string.cloud_music_submission_history_unknown_value),
            )
            submissionHistoryMediaMeta.text = context.getString(
                R.string.cloud_music_submission_history_media_meta,
                track.format?.takeIf(String::isNotBlank)?.uppercase(Locale.ROOT)
                    ?: context.getString(R.string.cloud_music_submission_history_unknown_value),
                formatDuration(track.durationMs),
            )
            submissionHistoryCreatedAt.text = context.getString(
                R.string.cloud_music_submission_history_created_at,
                track.createdAt?.let { timestamp -> DATE_FORMAT.format(Date(timestamp)) }
                    ?: context.getString(R.string.cloud_music_submission_history_unknown_value),
            )
            submissionHistoryLyrics.text = if (track.lyrics != null) {
                context.getString(
                    R.string.cloud_music_submission_history_lyrics_uploaded,
                    track.lyrics.format?.takeIf(String::isNotBlank)?.uppercase(Locale.ROOT)
                        ?: context.getString(R.string.cloud_music_submission_history_lyrics_file),
                )
            } else {
                context.getString(R.string.cloud_music_submission_history_lyrics_missing)
            }

            submissionHistoryStatusText.setText(status.labelRes)
            submissionHistoryStatusCard.setCardBackgroundColor(
                ContextCompat.getColor(context, status.backgroundColorRes),
            )
            submissionHistoryStatusText.setTextColor(
                ContextCompat.getColor(context, status.textColorRes),
            )

            val reason = status.fixedReasonRes?.let(context::getString)
                ?: track.statusReason?.takeIf(String::isNotBlank)?.let { statusReason ->
                    context.getString(
                        if (status.emphasizeReason) {
                            R.string.cloud_music_submission_history_rejection_reason_value
                        } else {
                            R.string.cloud_music_submission_history_reason_value
                        },
                        statusReason,
                    )
                }
            submissionHistoryReason.isVisible = reason != null
            submissionHistoryReason.text = reason
            submissionHistoryReason.setTextColor(
                ContextCompat.getColor(
                    context,
                    if (status.emphasizeReason) {
                        R.color.cloud_music_submission_reason_danger_text
                    } else {
                        R.color.cloud_music_submission_reason_text
                    },
                ),
            )

            submissionHistoryAction.isVisible = status.actionLabelRes != null
            status.actionLabelRes?.let(submissionHistoryAction::setText)
            submissionHistoryAction.backgroundTintList = ColorStateList.valueOf(
                ContextCompat.getColor(context, R.color.primary),
            )
            submissionHistoryAction.setOnClickListener {
                if (status.actionLabelRes != null) onResubmitClick(track)
            }
        }
    }

    private data class StatusPresentation(
        val labelRes: Int,
        val backgroundColorRes: Int,
        val textColorRes: Int,
        val actionLabelRes: Int? = null,
        val fixedReasonRes: Int? = null,
        val emphasizeReason: Boolean = false,
    )

    private fun statusPresentation(track: CloudMusicTrackDto): StatusPresentation =
        when (track.status?.lowercase(Locale.ROOT)) {
            "temp" -> StatusPresentation(
                R.string.cloud_music_submission_status_temp,
                R.color.cloud_music_submission_status_neutral_bg,
                R.color.cloud_music_submission_status_neutral_text,
            )

            "pending_review" -> StatusPresentation(
                R.string.cloud_music_submission_status_pending,
                R.color.cloud_music_submission_status_pending_bg,
                R.color.cloud_music_submission_status_pending_text,
                actionLabelRes = R.string.cloud_music_submission_action_complete,
            )

            "active" -> StatusPresentation(
                R.string.cloud_music_submission_status_active,
                R.color.cloud_music_submission_status_active_bg,
                R.color.cloud_music_submission_status_active_text,
                fixedReasonRes = R.string.cloud_music_submission_status_active_detail,
            )

            "disabled" -> StatusPresentation(
                R.string.cloud_music_submission_status_disabled,
                R.color.cloud_music_submission_status_disabled_bg,
                R.color.cloud_music_submission_status_disabled_text,
            )

            "rejected" -> StatusPresentation(
                R.string.cloud_music_submission_status_rejected,
                R.color.cloud_music_submission_status_rejected_bg,
                R.color.cloud_music_submission_status_rejected_text,
                actionLabelRes = R.string.cloud_music_submission_action_resubmit,
                emphasizeReason = true,
            )

            "deleted" -> StatusPresentation(
                R.string.cloud_music_submission_status_deleted,
                R.color.cloud_music_submission_status_deleted_bg,
                R.color.cloud_music_submission_status_deleted_text,
                fixedReasonRes = R.string.cloud_music_submission_status_deleted_detail,
            )

            else -> StatusPresentation(
                R.string.cloud_music_submission_status_unknown,
                R.color.cloud_music_submission_status_neutral_bg,
                R.color.cloud_music_submission_status_neutral_text,
            )
        }

    private fun formatDuration(durationMs: Long): String {
        val totalSeconds = durationMs.coerceAtLeast(0L) / 1_000L
        return String.format(Locale.ROOT, "%02d:%02d", totalSeconds / 60L, totalSeconds % 60L)
    }

    companion object {
        private val DATE_FORMAT = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())

        private val ITEM_DIFF = object : DiffUtil.ItemCallback<CloudMusicTrackDto>() {
            override fun areItemsTheSame(
                oldItem: CloudMusicTrackDto,
                newItem: CloudMusicTrackDto,
            ): Boolean = oldItem.uuid == newItem.uuid

            override fun areContentsTheSame(
                oldItem: CloudMusicTrackDto,
                newItem: CloudMusicTrackDto,
            ): Boolean = oldItem == newItem
        }
    }
}
