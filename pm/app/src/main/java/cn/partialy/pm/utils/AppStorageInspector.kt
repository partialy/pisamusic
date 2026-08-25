package cn.partialy.pm.utils

import android.content.Context
import android.os.Environment
import android.os.StatFs
import java.io.File

object AppStorageInspector {

    data class PhoneStorage(
        val totalBytes: Long,
        val usedBytes: Long,
        val availableBytes: Long,
    )

    data class AppCacheBreakdown(
        val phone: PhoneStorage,
        val songCacheBytes: Long,
        val lyricCacheBytes: Long,
        val downloadedBytes: Long,
        val downloadedAudioCount: Int,
    ) {
        val appUsageBytes: Long
            get() = songCacheBytes + lyricCacheBytes + downloadedBytes
    }

    /** 歌曲缓存大小由 [PlaybackMediaCache] 的 facade 提供，避免扫描无关缓存目录。 */
    fun compute(context: Context, songCacheBytes: Long): AppCacheBreakdown {
        val phone = queryPhoneStorage()
        val downloadDir = File(DownloadPathManager.getDownloadPath(context))
        val downloadedBytes = directorySize(downloadDir)
        val downloadedCount = countAudioFiles(downloadDir)
        val lyricBytes = lyricCacheSize(context.cacheDir)
        val indexedLyricBytes = LocalMediaIndexDbStore(context).lyricBytes()
        return AppCacheBreakdown(
            phone = phone,
            songCacheBytes = songCacheBytes.coerceAtLeast(0L),
            lyricCacheBytes = lyricBytes + indexedLyricBytes,
            downloadedBytes = downloadedBytes,
            downloadedAudioCount = downloadedCount,
        )
    }

    private fun isLyricCacheFileName(name: String): Boolean {
        if (name.startsWith("local_")) return true
        return name.startsWith("KG_") || name.startsWith("WY_") || name.startsWith("KW_")
    }

    private fun lyricCacheSize(cacheDir: File): Long {
        var sum = 0L
        cacheDir.listFiles()?.forEach { f ->
            if (f.isFile && isLyricCacheFileName(f.name)) {
                sum += f.length()
            }
        }
        return sum
    }

    fun directorySize(root: File): Long {
        if (!root.exists()) return 0L
        var size = 0L
        try {
            root.walkTopDown().forEach { f ->
                if (f.isFile) size += f.length()
            }
        } catch (_: Exception) {
        }
        return size
    }

    private fun countAudioFiles(root: File): Int {
        if (!root.exists()) return 0
        val extOk = setOf("mp3", "flac", "m4a", "aac", "ogg", "wav", "opus")
        var n = 0
        try {
            root.walkTopDown().forEach { f ->
                if (f.isFile) {
                    val ext = f.extension.lowercase()
                    if (ext in extOk) n++
                }
            }
        } catch (_: Exception) {
        }
        return n
    }

    private fun queryPhoneStorage(): PhoneStorage {
        return try {
            val path = Environment.getExternalStorageDirectory().absolutePath
            val stat = StatFs(path)
            val total = stat.blockCountLong * stat.blockSizeLong
            val avail = stat.availableBlocksLong * stat.blockSizeLong
            val used = (total - avail).coerceAtLeast(0L)
            PhoneStorage(total, used, avail.coerceAtLeast(0L))
        } catch (_: Exception) {
            PhoneStorage(0L, 0L, 0L)
        }
    }

    fun formatSize(bytes: Long): String {
        if (bytes <= 0L) return "0 B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format("%.2f KB", kb)
        val mb = kb / 1024
        if (mb < 1024) return String.format("%.2f MB", mb)
        val gb = mb / 1024
        return String.format("%.2f GB", gb)
    }

    fun clearLyricCache(cacheDir: File) {
        cacheDir.listFiles()?.forEach { f ->
            if (f.isFile && isLyricCacheFileName(f.name)) {
                f.delete()
            }
        }
    }

    fun clearLyricCache(context: Context) {
        clearLyricCache(context.cacheDir)
        LocalMediaIndexDbStore(context).clearLyrics()
    }

    fun clearDownloadedMusic(downloadRoot: File) {
        if (!downloadRoot.exists()) return
        downloadRoot.listFiles()?.forEach { it.deleteRecursively() }
    }
}
