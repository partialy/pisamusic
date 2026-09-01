package cn.partialy.pm.announcement

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import cn.partialy.pm.R
import cn.partialy.pm.activity.PlayerActivity
import cn.partialy.pm.activity.ShareDetailActivity
import cn.partialy.pm.activity.WebContentActivity
import cn.partialy.pm.listen.ListenTogetherScanLink
import cn.partialy.pm.share.ShareLink

object AnnouncementActionExecutor {

    fun execute(context: Context, action: AnnouncementAction): Boolean {
        return try {
            when (action) {
                AnnouncementAction.None -> true

                is AnnouncementAction.Copy -> {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                    if (clipboard != null) {
                        clipboard.setPrimaryClip(ClipData.newPlainText(action.label.ifEmpty { "PisaMusic" }, action.value))
                        Toast.makeText(context, R.string.common_copied, Toast.LENGTH_SHORT).show()
                        true
                    } else {
                        Toast.makeText(context, R.string.common_copy_failed, Toast.LENGTH_SHORT).show()
                        false
                    }
                }

                is AnnouncementAction.Url -> {
                    if (!isAllowedAnnouncementUrl(action.url)) {
                        Toast.makeText(context, R.string.web_content_invalid_url, Toast.LENGTH_SHORT).show()
                        return false
                    }
                    if (action.openMode == AnnouncementAction.Url.OpenMode.BROWSER) {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(action.url)).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        context.startActivity(intent)
                    } else {
                        WebContentActivity.start(context, action.url, action.label)
                    }
                    true
                }

                is AnnouncementAction.Protocol -> {
                    if (!isAllowedAnnouncementProtocol(action.value)) {
                        Toast.makeText(context, R.string.listen_together_scan_invalid, Toast.LENGTH_SHORT).show()
                        return false
                    }
                    when (val parsed = ListenTogetherScanLink.parse(action.value)) {
                        is ListenTogetherScanLink.Action.JoinRoom -> {
                            PlayerActivity.startForListenTogetherJoin(context, parsed.roomId)
                            true
                        }
                        null -> {
                            val share = ShareLink.parse(action.value)
                            if (share != null) {
                                ShareDetailActivity.start(context, share.uuid)
                                true
                            } else {
                                Toast.makeText(context, R.string.listen_together_scan_invalid, Toast.LENGTH_SHORT).show()
                                false
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Toast.makeText(context, e.message ?: context.getString(R.string.common_operation_failed), Toast.LENGTH_SHORT).show()
            false
        }
    }
}
