package cn.partialy.pm.utils

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.Tag
import org.jaudiotagger.tag.flac.FlacTag
import org.jaudiotagger.tag.images.Artwork
import java.io.File

/**
 * 读取内嵌封面字节，供 Coil 直接加载（与 pmNative [MediaLibraryScanner] 一致）。
 *
 * 优先 [MediaMetadataRetriever]：`file` 用路径，`content` 等用 [MediaMetadataRetriever.setDataSource]（Context, Uri）。
 * 失败时再尝试 jaudiotagger（含 FLAC picture 块）。
 */
object AudioEmbeddedArtReader {

    /** 与 pmNative `MediaLibraryScanner.applyDataSource` 相同策略。 */
    fun readEmbeddedCoverBytes(context: Context, uri: Uri): ByteArray? {
        val app = context.applicationContext
        val retriever = MediaMetadataRetriever()
        return try {
            applyDataSource(retriever, app, uri)
            retriever.embeddedPicture?.takeIf { it.isNotEmpty() }
        } catch (_: Exception) {
            null
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
            }
        }
    }

    fun readEmbeddedCoverBytes(context: Context, file: File): ByteArray? {
        if (!file.exists() || !file.isFile) return null
        return readEmbeddedCoverBytes(context, Uri.fromFile(file))
    }

    /**
     * 已 [AudioFileIO.read] 得到 [tag] 时使用：先 Retriever（file URI），再解析标签。
     */
    fun readEmbeddedCoverBytesWithTag(context: Context, file: File, tag: Tag?): ByteArray? {
        if (!file.exists() || !file.isFile) return null
        readEmbeddedCoverBytes(context, Uri.fromFile(file))?.let { return it }
        return tag?.let { readCoverBytesFromTag(it) }
    }

    /** 仅从 Tag 取图（Retriever 失败时的补充，如部分 FLAC）。 */
    fun readCoverBytesFromTag(tag: Tag): ByteArray? {
        return try {
            extractArtworkBytes(tag)?.takeIf { it.isNotEmpty() }
        } catch (_: Exception) {
            null
        }
    }

    private fun applyDataSource(retriever: MediaMetadataRetriever, context: Context, uri: Uri) {
        when (uri.scheme?.lowercase()) {
            "file" -> {
                val path = uri.path ?: throw IllegalArgumentException("no path")
                retriever.setDataSource(path)
            }
            else -> retriever.setDataSource(context, uri)
        }
    }

    private fun extractArtworkBytes(tag: Tag): ByteArray? {
        extractFromArtworkList(tag)?.let { return it }
        val flacTag = tag as? FlacTag ?: return null
        val images = try {
            flacTag.images
        } catch (_: Exception) {
            null
        } ?: return null
        for (pic in images) {
            val data = try {
                pic.imageData
            } catch (_: Exception) {
                null
            }
            if (data != null && data.isNotEmpty()) return data
        }
        return null
    }

    private fun extractFromArtworkList(tag: Tag): ByteArray? {
        val list = try {
            tag.artworkList
        } catch (_: Exception) {
            null
        } ?: return null
        for (art in list) {
            val bytes = artworkBinary(art)
            if (bytes != null && bytes.isNotEmpty()) return bytes
        }
        return null
    }

    private fun artworkBinary(art: Artwork): ByteArray? {
        return try {
            art.binaryData?.takeIf { it.isNotEmpty() }
                ?: art.getBinaryData()?.takeIf { it.isNotEmpty() }
        } catch (_: Exception) {
            null
        }
    }
}
