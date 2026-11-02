package cn.partialy.pm.ui.playlistedit

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import java.io.File
import java.util.UUID

/** 编辑会话仅使用独立临时文件，提交时再生成新文件，始终不覆盖原封面。 */
internal class PlaylistEditCoverFiles(private val context: Context) {
    private val pendingDirectory = File(context.cacheDir, "playlist_edit_covers")
    private val persistentDirectory = File(context.filesDir, "playlist_covers")

    fun normalize(uri: Uri): String {
        pendingDirectory.mkdirs()
        val output = File(pendingDirectory, "${UUID.randomUUID()}.jpg")
        // ImageDecoder 会应用 EXIF 方向，解码前限制尺寸，避免大图占满内存。
        val bitmap = ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            val largest = maxOf(info.size.width, info.size.height)
            if (largest > 1024) {
                val ratio = 1024.0 / largest
                decoder.setTargetSize(maxOf(1, (info.size.width * ratio).toInt()),
                    maxOf(1, (info.size.height * ratio).toInt()))
            }
        }
        try {
            output.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it)) }
            return MinePlaylistCoverResolver.storageValueForAbsolutePath(output.absolutePath)
        } catch (error: Exception) {
            output.delete()
            throw error
        } finally {
            bitmap.recycle()
        }
    }

    fun persist(cover: String): File? {
        val pending = ownedFile(cover, pendingDirectory) ?: return null
        check(pending.isFile) { "封面临时文件已失效" }
        persistentDirectory.mkdirs()
        val output = File(persistentDirectory, "${UUID.randomUUID()}.jpg")
        try {
            pending.copyTo(output, overwrite = false)
            return output
        } catch (error: Exception) {
            output.delete()
            throw error
        }
    }

    fun deleteTemporary(cover: String) {
        ownedFile(cover, pendingDirectory)?.delete()
    }

    fun deletePersistentIfUnused(cover: String, referencedCovers: Collection<String>) {
        val file = ownedFile(cover, persistentDirectory) ?: return
        if (referencedCovers.any { other ->
            MinePlaylistCoverResolver.isLocalFileCover(other) &&
                runCatching { File(other.removePrefix(MinePlaylistCoverResolver.LOCAL_FILE_PREFIX)).canonicalFile == file }.getOrDefault(false)
        }) return
        file.delete()
    }

    private fun ownedFile(cover: String, directory: File): File? {
        if (!MinePlaylistCoverResolver.isLocalFileCover(cover)) return null
        return runCatching {
            File(cover.trim().removePrefix(MinePlaylistCoverResolver.LOCAL_FILE_PREFIX)).canonicalFile
                .takeIf { it.parentFile == directory.canonicalFile }
        }.getOrNull()
    }
}
