package cn.partialy.pm.ui.dialog

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import cn.partialy.pm.R
import cn.partialy.pm.listen.ListenTogetherScanLink
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

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
            createQrBitmap(shareLink, QR_SIZE),
        )
        view.findViewById<ImageButton>(R.id.listenTogetherQrCopyButton).setOnClickListener {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("PisaMusic 一起听房间号", roomId))
            Toast.makeText(context, R.string.listen_together_room_id_copied, Toast.LENGTH_SHORT).show()
        }
    }

    private fun createQrBitmap(content: String, size: Int): Bitmap {
        val matrix = QRCodeWriter().encode(
            content,
            BarcodeFormat.QR_CODE,
            size,
            size,
            mapOf(
                EncodeHintType.CHARACTER_SET to "UTF-8",
                EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
                EncodeHintType.MARGIN to 2,
            ),
        )
        val pixels = IntArray(size * size)
        for (y in 0 until size) {
            for (x in 0 until size) {
                pixels[y * size + x] = if (matrix[x, y]) Color.BLACK else Color.WHITE
            }
        }
        return Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
            setPixels(pixels, 0, size, 0, 0, size, size)
        }
    }

    private const val QR_SIZE = 432
}
