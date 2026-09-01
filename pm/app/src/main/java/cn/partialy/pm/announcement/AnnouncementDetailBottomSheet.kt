package cn.partialy.pm.announcement

import android.app.Activity
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import cn.partialy.pm.R
import cn.partialy.pm.model.AnnouncementItem
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton

/**
 * 首页与设置页共用的公告详情 Sheet。
 *
 * 首页将 [dismissible] 设为 false，以便在用户确认前保持启动公告可见；
 * 设置页则使用默认值，允许通过返回键或点击遮罩关闭。
 */
object AnnouncementDetailBottomSheet {

    fun show(
        activity: Activity,
        item: AnnouncementItem,
        dismissible: Boolean = true,
        onConfirmed: () -> Unit = {},
        onCancelled: () -> Unit = {},
    ): BottomSheetDialog {
        val sheet = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        sheet.setContentView(R.layout.layout_announcement_bottom_sheet)
        sheet.behavior.isHideable = dismissible
        sheet.behavior.state = BottomSheetBehavior.STATE_EXPANDED
        sheet.setCancelable(dismissible)
        sheet.setCanceledOnTouchOutside(dismissible)

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
                onAction = { action -> AnnouncementActionExecutor.execute(activity, action) },
            )
        }

        sheet.findViewById<MaterialButton>(R.id.confirmButton)?.apply {
            text = item.confirmText.ifBlank {
                activity.getString(R.string.announcement_confirm_default)
            }
            setOnClickListener {
                if (!sheet.isShowing) return@setOnClickListener
                onConfirmed()
                sheet.dismiss()
            }
        }

        val gotoButton = sheet.findViewById<MaterialButton>(R.id.gotoButton)
        val buttonSpacer = sheet.findViewById<View>(R.id.buttonSpacer)
        val gotoUrl = item.gotoUrl?.trim().orEmpty()
        val showGoto = item.showGotoButton && gotoUrl.isNotEmpty()
        gotoButton?.visibility = if (showGoto) View.VISIBLE else View.GONE
        buttonSpacer?.visibility = if (showGoto) View.VISIBLE else View.GONE
        if (showGoto) {
            gotoButton?.apply {
                text = activity.getString(R.string.announcement_goto)
                setOnClickListener {
                    if (!sheet.isShowing) return@setOnClickListener
                    AnnouncementActionExecutor.execute(
                        activity,
                        AnnouncementAction.Url(
                            label = activity.getString(R.string.announcement_goto),
                            url = gotoUrl,
                        ),
                    )
                    onConfirmed()
                    sheet.dismiss()
                }
            }
        }

        sheet.setOnCancelListener { onCancelled() }
        sheet.show()
        return sheet
    }
}
