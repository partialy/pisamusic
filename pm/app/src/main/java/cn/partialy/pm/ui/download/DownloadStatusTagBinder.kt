package cn.partialy.pm.ui.download

import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.TextView
import androidx.core.graphics.ColorUtils
import cn.partialy.pm.R
import cn.partialy.pm.download.MetadataWriteStatus
import cn.partialy.pm.download.task.DownloadTask
import cn.partialy.pm.download.task.DownloadTaskStatus
import com.google.android.material.color.MaterialColors
import java.io.File

object DownloadStatusTagBinder {
    fun isFileMissing(task: DownloadTask): Boolean = task.targetPath?.let { !File(it).isFile }
        ?: (task.status == DownloadTaskStatus.COMPLETED)

    fun labelRes(task: DownloadTask): Int = when {
        isFileMissing(task) -> R.string.download_row_missing
        task.metadataStatus in setOf(MetadataWriteStatus.PARTIAL, MetadataWriteStatus.FAILED, MetadataWriteStatus.PENDING, MetadataWriteStatus.INTERRUPTED) -> R.string.download_row_repair
        task.status == DownloadTaskStatus.FAILED -> R.string.download_management_status_failed
        task.status == DownloadTaskStatus.CANCELLED -> R.string.download_management_status_cancelled
        else -> R.string.download_management_status_completed
    }

    fun bind(view: TextView, task: DownloadTask) {
        val label = labelRes(task)
        val color = when (label) {
            R.string.download_row_missing, R.string.download_management_status_failed -> MaterialColors.getColor(view, com.google.android.material.R.attr.colorError)
            R.string.download_row_repair -> androidx.core.content.ContextCompat.getColor(view.context, R.color.song_tag_kw_text)
            R.string.download_management_status_cancelled -> MaterialColors.getColor(view, com.google.android.material.R.attr.colorOnSurfaceVariant)
            else -> MaterialColors.getColor(view, com.google.android.material.R.attr.colorPrimary)
        }
        view.setText(label)
        bindStyle(view, color)
    }

    fun bindQuality(view: TextView, qualityKey: String) {
        view.text = DownloadQualityLabelFormatter.format(view.context, qualityKey)
        bindStyle(view, MaterialColors.getColor(view, com.google.android.material.R.attr.colorPrimary))
    }

    private fun bindStyle(view: TextView, color: Int) {
        val density = view.resources.displayMetrics.density
        view.includeFontPadding = false
        view.gravity = Gravity.CENTER
        view.setTextColor(color)
        view.textSize = 9f
        view.setPadding((3 * density).toInt(), density.toInt().coerceAtLeast(1), (3 * density).toInt(), density.toInt().coerceAtLeast(1))
        view.background = GradientDrawable().apply {
            cornerRadius = 2 * density
            setColor(ColorUtils.setAlphaComponent(color, 18))
            setStroke((0.5f * density).toInt().coerceAtLeast(1), ColorUtils.setAlphaComponent(color, 100))
        }
    }
}
