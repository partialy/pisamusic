package cn.partialy.pm.ui.download

import android.app.Dialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.StringRes
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.R
import cn.partialy.pm.download.MetadataWriteStatus
import cn.partialy.pm.download.task.DownloadTask
import cn.partialy.pm.download.task.DownloadTaskStatus
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.dialog.PmSlotDialog
import cn.partialy.pm.ui.dialog.SongInfoHeaderBinder
import cn.partialy.pm.ui.message.PmMessage
import com.google.android.material.color.MaterialColors
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 已完成文件读取后展示；IO 和迟到响应丢弃由调用方生命周期负责。 */
object DownloadTaskDetailDialog {
    fun show(activity: FragmentActivity, task: DownloadTask, file: DownloadTaskFileInfo): Dialog {
        lateinit var dialog: Dialog
        val density = activity.resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val unknown = activity.getString(R.string.download_details_unknown)
        val body = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), 0, dp(16), dp(12))
        }
        fun copy(@StringRes label: Int, value: String) {
            try {
                val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText(activity.getString(label), value))
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                    PmMessage.success(activity, activity.getString(R.string.download_details_copied, activity.getString(label)), dialog = dialog)
                }
            } catch (_: Exception) {
                PmMessage.error(activity, R.string.download_details_copy_failed, dialog = dialog)
            }
        }
        fun row(@StringRes labelRes: Int, value: String?, copyable: Boolean = false) {
            val actual = value?.takeIf(String::isNotBlank)
            val label = activity.getString(labelRes)
            val row = LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                minimumHeight = dp(48)
                setPadding(0, dp(8), 0, dp(8))
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            }
            row.addView(TextView(activity).apply {
                text = label
                textSize = 11f
                setTextColor(MaterialColors.getColor(this, com.google.android.material.R.attr.colorOnSurfaceVariant))
            })
            row.addView(TextView(activity).apply {
                text = actual ?: unknown
                textSize = 13f
                setTextColor(MaterialColors.getColor(this, com.google.android.material.R.attr.colorOnSurface))
                setPadding(0, dp(2), 0, 0)
            })
            if (copyable && actual != null) {
                val background = TypedValue()
                activity.theme.resolveAttribute(android.R.attr.selectableItemBackground, background, true)
                row.background = ContextCompat.getDrawable(activity, background.resourceId)
                row.isClickable = true
                row.isFocusable = true
                row.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
                row.contentDescription = activity.getString(R.string.download_details_copy_cd, label, actual)
                row.setOnClickListener { copy(labelRes, actual) }
            }
            body.addView(row)
        }
        val sourceRes = when (task.source) {
            SongType.KG -> R.string.download_details_source_kg
            SongType.WY -> R.string.download_details_source_wy
            SongType.KW -> R.string.download_details_source_kw
            SongType.CLOUD -> R.string.download_details_source_cloud
            SongType.LOCAL -> R.string.download_details_source_local
        }
        val stateRes = when (task.status) {
            DownloadTaskStatus.QUEUED -> R.string.download_management_status_queued
            DownloadTaskStatus.PREPARING -> R.string.download_management_status_preparing
            DownloadTaskStatus.DOWNLOADING -> R.string.download_row_unknown_progress
            DownloadTaskStatus.PAUSING -> R.string.download_row_pausing
            DownloadTaskStatus.PAUSED -> R.string.download_row_paused
            DownloadTaskStatus.PROCESSING -> R.string.download_management_status_processing
            DownloadTaskStatus.COMPLETED -> R.string.download_management_status_completed
            DownloadTaskStatus.FAILED -> R.string.download_management_status_failed
            DownloadTaskStatus.CANCELLED -> R.string.download_management_status_cancelled
        }
        val metadataRes = when (task.metadataStatus) {
            MetadataWriteStatus.UNKNOWN -> R.string.download_details_unknown
            MetadataWriteStatus.PENDING -> R.string.download_details_metadata_pending
            MetadataWriteStatus.SUCCESS -> R.string.download_details_metadata_success
            MetadataWriteStatus.PARTIAL -> R.string.download_details_metadata_partial
            MetadataWriteStatus.FAILED -> R.string.download_details_metadata_failed
            MetadataWriteStatus.SKIPPED -> R.string.download_details_metadata_skipped
            MetadataWriteStatus.INTERRUPTED -> R.string.download_details_metadata_interrupted
        }
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        fun time(value: Long?) = value?.takeIf { it > 0 }?.let { formatter.format(Date(it)) }
        row(R.string.download_details_name, file.song.name, true)
        row(R.string.download_details_artist, file.song.artist, true)
        row(R.string.download_details_source, activity.getString(sourceRes))
        row(R.string.download_details_quality, DownloadQualityLabelFormatter.format(activity, task.qualityKey))
        row(R.string.download_details_state, activity.getString(if (!file.exists && (task.targetPath != null || task.status == DownloadTaskStatus.COMPLETED)) R.string.download_row_missing else stateRes))
        row(R.string.download_details_metadata, activity.getString(metadataRes))
        row(R.string.download_details_album, file.song.album, true)
        row(R.string.download_details_duration, file.durationMs?.takeIf { it > 0 }?.let { milliseconds ->
            val seconds = milliseconds / 1000
            if (seconds >= 3600) String.format(Locale.getDefault(), "%d:%02d:%02d", seconds / 3600, seconds / 60 % 60, seconds % 60)
            else String.format(Locale.getDefault(), "%d:%02d", seconds / 60, seconds % 60)
        })
        row(R.string.download_details_size, file.sizeBytes?.let { android.text.format.Formatter.formatShortFileSize(activity, it) })
        row(R.string.download_details_path, task.targetPath, true)
        row(R.string.download_details_created, time(task.createdAt))
        if (task.status == DownloadTaskStatus.FAILED || task.status == DownloadTaskStatus.CANCELLED) {
            row(R.string.download_details_updated, time(task.updatedAt))
        } else {
            row(R.string.download_details_completed, time(task.completedAt))
        }
        val errors = listOfNotNull(file.error, task.errorMessage, task.metadataWarning).filter(String::isNotBlank).distinct()
        if (errors.isNotEmpty()) row(R.string.download_details_error, errors.joinToString("\n"))
        dialog = PmSlotDialog.Builder(activity)
            .setHeaderLayout(R.layout.include_song_info_header) { header, _ ->
                header.setPadding(dp(16), dp(16), dp(16), dp(12))
                SongInfoHeaderBinder.bind(header, file.song)
            }
            .setContentView(body)
            .setSingleButton(activity.getString(R.string.dialog_ok))
            .show()
        return dialog
    }
}
