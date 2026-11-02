package cn.partialy.pm.ui.dialog

import android.content.ClipData
import android.content.ClipboardManager
import android.app.Activity
import android.content.Context
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.R
import cn.partialy.pm.listen.ListenTogetherScanLink
import cn.partialy.pm.share.ShareQrBitmapFactory

object ListenTogetherQrDialog {
    fun show(context: Activity, roomName: String, roomId: String) {
        val shareLink = ListenTogetherScanLink.buildWebLink(roomId)
        PmSlotDialog.Builder(context)
            .setContentLayout(R.layout.dialog_listen_together_qr) { view, _ ->
                bindContent(context, view, roomName, roomId, shareLink)
            }
            .setSingleButton(context.getString(R.string.listen_together_close))
            .show()
    }

    private fun bindContent(
        activity: Activity,
        view: View,
        roomName: String,
        roomId: String,
        shareLink: String,
    ) {
        val context = view.context
        view.findViewById<TextView>(R.id.listenTogetherQrTitle).text = roomName
        view.findViewById<TextView>(R.id.listenTogetherQrRoomId).text =
            context.getString(R.string.listen_together_qr_room_id, roomId)
        view.findViewById<ImageView>(R.id.listenTogetherQrImage).setImageBitmap(
            ShareQrBitmapFactory.create(shareLink, QR_SIZE),
        )
        view.findViewById<ImageButton>(R.id.listenTogetherQrCopyButton).setOnClickListener {
            try {
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(
                    ClipData.newPlainText(context.getString(R.string.listen_together_clipboard_room_label), roomId),
                )
                if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU) {
                    PmMessage.success(activity, R.string.listen_together_room_id_copied)
                }
            } catch (_: Exception) {
                PmMessage.error(activity, R.string.common_copy_failed)
            }
        }
    }

    private const val QR_SIZE = 432
}
