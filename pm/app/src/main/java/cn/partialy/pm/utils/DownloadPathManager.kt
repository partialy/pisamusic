package cn.partialy.pm.utils

import android.content.Context
import android.os.Environment
import java.io.File
import java.util.Locale

object DownloadPathManager {
    private const val PREFS_NAME = "download_settings"
    private const val KEY_DOWNLOAD_PATH = "download_path"

    fun getDefaultPath(): String {
        val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        return File(downloadDir, "Pisa Music").absolutePath
    }

    fun getDownloadPath(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_DOWNLOAD_PATH, getDefaultPath()) ?: getDefaultPath()
    }

    /**
     * 设置页等 UI 展示用短路径，例如 `Download/Pisa Music`，避免整段 `/storage/emulated/0/...`。
     */
    fun getDisplayPath(context: Context): String {
        val raw = getDownloadPath(context).replace('\\', '/').trimEnd('/')
        if (raw.isEmpty()) return raw
        val lower = raw.lowercase(Locale.US)
        val downloadIdx = lower.indexOf("/download/")
        if (downloadIdx >= 0) {
            return raw.substring(downloadIdx + 1)
        }
        val prefixes = listOf(
            "/storage/emulated/0/",
            "/storage/emulated/1/",
            "/sdcard/",
            "/mnt/sdcard/",
        )
        for (prefix in prefixes) {
            val pl = prefix.lowercase(Locale.US)
            if (lower.startsWith(pl)) {
                return raw.substring(pl.length).trimStart('/')
            }
        }
        val parts = raw.split('/').filter { it.isNotEmpty() }
        return parts.takeLast(3).joinToString("/")
    }

    fun setDownloadPath(context: Context, path: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_DOWNLOAD_PATH, path).apply()
    }

    fun createDownloadDirectory(path: String) {
        val dir = File(path)
        if (!dir.exists()) {
            dir.mkdirs()
        }
    }
} 