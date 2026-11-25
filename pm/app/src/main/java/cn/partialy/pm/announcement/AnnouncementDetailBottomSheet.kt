package cn.partialy.pm.announcement

import android.app.Activity
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.R
import cn.partialy.pm.model.AnnouncementItem
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton

/**
 * 首页与设置页共用的公告详情 Sheet。
 *
 * 启动自动展示使用 [automatic] 控制关闭方式和确认倒计时，手动打开可立即关闭。
 */
object AnnouncementDetailBottomSheet {

    fun show(
        activity: Activity,
        item: AnnouncementItem,
        automatic: Boolean = false,
        onConfirmed: () -> Unit = {},
        onCancelled: () -> Unit = {},
    ): BottomSheetDialog {
        val sheet = BottomSheetDialog(
            activity,
            R.style.ThemeOverlay_Pm_BottomSheetDialog,
        )
        sheet.setContentView(R.layout.layout_announcement_bottom_sheet)
        sheet.behavior.isHideable = !automatic
        sheet.behavior.state = BottomSheetBehavior.STATE_EXPANDED
        sheet.setCancelable(!automatic)
        sheet.setCanceledOnTouchOutside(!automatic)

        var confirmed = false
        fun confirm() {
            if (confirmed || !sheet.isShowing) return
            confirmed = true
            onConfirmed()
            sheet.dismiss()
        }

        sheet.findViewById<TextView>(R.id.announcementTitle)?.text =
            activity.getString(R.string.announcement_system_title)

        val metaView = sheet.findViewById<TextView>(R.id.announcementMeta)
        val meta = listOfNotNull(
            item.publisher.takeIf { it.isNotBlank() },
            item.time.takeIf { it.isNotBlank() },
        ).joinToString(" · ")
        metaView?.visibility = if (meta.isBlank()) View.GONE else View.VISIBLE
        metaView?.text = meta

        sheet.findViewById<ViewGroup>(R.id.announcementContentContainer)?.let { container ->
            AnnouncementContentRenderer.render(
                container = container,
                content = item.content,
                onAction = { action ->
                    if (sheet.isShowing && !confirmed && AnnouncementActionExecutor.execute(activity, action) &&
                        action is AnnouncementAction.Page
                    ) {
                        confirm()
                    }
                },
            )
        }

        val confirmButton = sheet.findViewById<MaterialButton>(R.id.confirmButton)
        val confirmText = item.confirmText.ifBlank {
            activity.getString(R.string.announcement_confirm_default)
        }
        val waitMilliseconds = if (automatic) item.waitSeconds.coerceAtLeast(0) * 1_000L else 0L
        var unlockAt = 0L
        confirmButton?.text = confirmText
        confirmButton?.isEnabled = waitMilliseconds == 0L
        confirmButton?.setOnClickListener {
            if (SystemClock.elapsedRealtime() >= unlockAt) confirm()
        }

        val gotoButton = sheet.findViewById<MaterialButton>(R.id.gotoButton)
        val buttonSpacer = sheet.findViewById<View>(R.id.buttonSpacer)
        val gotoAction = item.gotoAction ?: legacyGotoAction(item.gotoUrl)
        val showGoto = item.showGotoButton && gotoAction !is AnnouncementAction.None
        gotoButton?.visibility = if (showGoto) View.VISIBLE else View.GONE
        buttonSpacer?.visibility = if (showGoto) View.VISIBLE else View.GONE
        gotoButton?.setOnClickListener {
            if (showGoto && sheet.isShowing && !confirmed && AnnouncementActionExecutor.execute(activity, gotoAction)) {
                confirm()
            }
        }

        val refreshCountdown = object : Runnable {
            override fun run() {
                val button = confirmButton ?: return
                if (!sheet.isShowing) return
                val remainingMs = (unlockAt - SystemClock.elapsedRealtime()).coerceAtLeast(0L)
                button.isEnabled = remainingMs == 0L
                button.text = if (remainingMs == 0L) confirmText else {
                    activity.getString(R.string.announcement_confirm_countdown, confirmText, (remainingMs + 999L) / 1_000L)
                }
                if (remainingMs > 0L) {
                    button.postDelayed(this, (remainingMs - 1L) % 1_000L + 1L)
                }
            }
        }
        sheet.setOnDismissListener {
            confirmButton?.removeCallbacks(refreshCountdown)
            if (!confirmed) onCancelled()
        }
        sheet.show()
        PmMessage.register(sheet)
        if (waitMilliseconds > 0L) {
            unlockAt = SystemClock.elapsedRealtime() + waitMilliseconds
            refreshCountdown.run()
        }
        return sheet
    }

    private fun legacyGotoAction(raw: String?): AnnouncementAction {
        val value = raw?.trim().orEmpty()
        return when {
            isAllowedAnnouncementUrl(value) -> AnnouncementAction.Url(url = value)
            isAllowedAnnouncementProtocol(value) -> AnnouncementAction.Protocol(value = value)
            else -> AnnouncementAction.None
        }
    }
}
