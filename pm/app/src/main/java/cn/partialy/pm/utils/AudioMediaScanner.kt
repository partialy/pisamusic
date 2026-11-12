package cn.partialy.pm.utils

import android.content.Context
import android.media.MediaScannerConnection
import java.io.File

/** 只发布已提交的正式文件，系统媒体索引失败不改变下载或修复结果。 */
object AudioMediaScanner {
    @JvmStatic
    fun refresh(context: Context, file: File) {
        if (!file.isFile) return
        runCatching {
            MediaScannerConnection.scanFile(context.applicationContext, arrayOf(file.absolutePath), null, null)
        }
    }
}
