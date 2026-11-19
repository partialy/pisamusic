package cn.partialy.pm.ui.dialog

import android.app.Dialog
import android.content.Context
import android.view.Gravity
import cn.partialy.pm.R
import cn.partialy.pm.download.quota.SongDownloadQuotaSnapshot

/** 复用 PmMinimalDialog 提示下载配额不足（仅展示有限制的维度）。 */
object SongDownloadQuotaDialog {
    fun formatMessage(quota: SongDownloadQuotaSnapshot): String {
        val lines = mutableListOf("下载配额不足，当前剩余：")
        quota.daily.limit?.let { limit ->
            lines += "${quota.daily.remaining ?: 0} / $limit（次/天，0点刷新）"
        }
        quota.weekly.limit?.let { limit ->
            lines += "${quota.weekly.remaining ?: 0} / $limit（次/周，周一0点刷新）"
        }
        quota.monthly.limit?.let { limit ->
            lines += "${quota.monthly.remaining ?: 0} / $limit（次/月，1号0点刷新）"
        }
        quota.total.limit?.let { limit ->
            lines += "${quota.total.remaining ?: 0} / $limit（总数）"
        }
        return lines.joinToString("\n")
    }

    fun show(context: Context, quota: SongDownloadQuotaSnapshot): Dialog {
        return PmMinimalDialog.show(
            context = context,
            title = "下载配额不足",
            message = formatMessage(quota),
            confirmText = context.getString(R.string.dialog_i_know),
            messageGravity = Gravity.START,
            singleButton = true,
        )
    }
}
