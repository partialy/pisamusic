package cn.partialy.pm.ui.dialog

import android.app.Dialog
import android.content.Context
import android.view.Gravity
import cn.partialy.pm.R
import cn.partialy.pm.activity.LoginActivity
import cn.partialy.pm.download.quota.SongDownloadQuotaSnapshot

/** 复用 PmMinimalDialog 提示下载配额不足（仅展示有限制的维度）。 */
object SongDownloadQuotaDialog {
    fun formatMessage(quota: SongDownloadQuotaSnapshot): String {
        val isGuest = quota.isGuest || quota.subjectType == "device"
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
        if (quota.extraRemaining > 0L) {
            lines += "额外可用次数：${quota.extraRemaining} 次（常规配额不足时优先自动抵扣）"
        }
        if (isGuest) {
            lines += ""
            lines += "当前为游客模式，登录账号即可获取更高下载配额及注册赠送次数。"
        }
        return lines.joinToString("\n")
    }

    fun show(context: Context, quota: SongDownloadQuotaSnapshot): Dialog {
        val isGuest = quota.isGuest || quota.subjectType == "device"
        if (isGuest) {
            return PmMinimalDialog.show(
                context = context,
                title = "下载配额不足",
                message = formatMessage(quota),
                cancelText = context.getString(R.string.dialog_i_know),
                confirmText = "去登录",
                messageGravity = Gravity.START,
                singleButton = false,
                onConfirm = { LoginActivity.start(context) },
            )
        }
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
