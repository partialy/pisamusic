package cn.partialy.pm.ui.dialog

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import cn.partialy.pm.R
import cn.partialy.pm.listen.ListenTogetherScanLink
import cn.partialy.pm.share.ShareQrBitmapFactory

object ListenTogetherQrDialog {
    fun show(context: Context, roomName: String, roomId: String) {
        val shareLink = ListenTogetherScanLink.buildWebLink(roomId)
        PmSlotDialog.Builder(context)
            .setContentLayout(R.layout.dialog_listen_together_qr) { view, _ ->
                bindContent(view, roomName, roomId, shareLink)
            }
            .setSingleButton(context.getString(R.string.listen_together_close))
            .show()
    }

    private fun bindContent(
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
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("PisaMusic 一起听房间号", roomId))
            Toast.makeText(context, R.string.listen_together_room_id_copied, Toast.LENGTH_SHORT).show()
        }
    }

    private const val QR_SIZE = 432
}
