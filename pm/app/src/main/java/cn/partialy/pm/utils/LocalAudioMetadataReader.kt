package cn.partialy.pm.utils

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import cn.partialy.pm.download.DownloadFileLocks
import org.jaudiotagger.audio.AudioFile
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import java.io.File
import kotlin.math.roundToLong

data class LocalAudioMetadata(
    val title: String? = null,
    val artist: String? = null,
    val album: String? = null,
    val durationMs: Long? = null,
) {
    val durationSeconds: Int?
        get() = durationMs?.div(1000)?.takeIf { it in 1L..Int.MAX_VALUE.toLong() }?.toInt()

    internal fun supplementedBy(other: LocalAudioMetadata) = LocalAudioMetadata(
        title ?: other.title,
        artist ?: other.artist,
        album ?: other.album,
        durationMs ?: other.durationMs,
    )

    internal val isComplete: Boolean
        get() = title != null && artist != null && album != null && durationMs != null
}

/** 直接读取文件当前标签；逐字段补读，单个损坏字段不能使整首歌曲消失。仅在 IO 线程调用。 */
object LocalAudioMetadataReader {
    fun read(context: Context, file: File): LocalAudioMetadata = DownloadFileLocks.withFile(file) {
        val tagged = runCatching { fromAudio(AudioFileIO.read(file)) }.getOrDefault(LocalAudioMetadata())
        combine(tagged, readRetriever(context, Uri.fromFile(file)))
    }

    fun read(context: Context, uri: Uri, displayName: String? = null): LocalAudioMetadata {
        if (uri.scheme == "file") {
            return uri.path?.let { read(context, File(it)) } ?: LocalAudioMetadata()
        }
        // 使用只读描述符解析 SAF/MediaStore 音频，不复制整首歌曲，也不依赖 DATA 绝对路径。
        val extension = resolveExtension(context, uri, displayName)
        val tagged = if (extension == null) LocalAudioMetadata() else runCatching {
            context.contentResolver.openFileDescriptor(uri, "r")?.use { descriptor ->
                fromAudio(AudioFileIO.readAs(File("/proc/self/fd/${descriptor.fd}"), extension))
            } ?: LocalAudioMetadata()
        }.getOrDefault(LocalAudioMetadata())
        return combine(tagged, readRetriever(context, uri))
    }

    private fun combine(tagged: LocalAudioMetadata, native: LocalAudioMetadata): LocalAudioMetadata =
        // 本地去重使用毫秒时长，保留与旧 Retriever/MediaStore 索引一致的精度。
        tagged.copy(durationMs = native.durationMs ?: tagged.durationMs).supplementedBy(native)

    private fun fromAudio(audio: AudioFile): LocalAudioMetadata {
        fun field(key: FieldKey) = runCatching { cleanText(audio.tag?.getFirst(key)) }.getOrNull()
        return LocalAudioMetadata(
            title = field(FieldKey.TITLE),
            artist = field(FieldKey.ARTIST),
            album = field(FieldKey.ALBUM),
            durationMs = runCatching {
                audio.audioHeader?.preciseTrackLength?.takeIf { it.isFinite() && it > 0 }
                    ?.times(1000)?.roundToLong()
            }.getOrNull(),
        )
    }

    private fun readRetriever(context: Context, uri: Uri): LocalAudioMetadata {
        val retriever = MediaMetadataRetriever()
        return try {
            if (uri.scheme == "file") retriever.setDataSource(requireNotNull(uri.path))
            else retriever.setDataSource(context.applicationContext, uri)
            fun field(key: Int) = runCatching { cleanText(retriever.extractMetadata(key)) }.getOrNull()
            LocalAudioMetadata(
                title = field(MediaMetadataRetriever.METADATA_KEY_TITLE),
                artist = field(MediaMetadataRetriever.METADATA_KEY_ARTIST),
                album = field(MediaMetadataRetriever.METADATA_KEY_ALBUM),
                durationMs = field(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()?.takeIf { it > 0 },
            )
        } catch (_: Exception) {
            LocalAudioMetadata()
        } finally {
            runCatching { retriever.release() }
        }
    }

    private fun resolveExtension(context: Context, uri: Uri, displayName: String?): String? {
        val name = displayName ?: runCatching {
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
                if (it.moveToFirst()) it.getString(0) else null
            }
        }.getOrNull()
        val extension = name?.substringAfterLast('.', "")?.lowercase()?.takeIf { it.isNotBlank() }
        return extension ?: runCatching {
            context.contentResolver.getType(uri)?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
        }.getOrNull()
    }

    private fun cleanText(value: String?): String? = value?.trim()?.takeIf {
        it.isNotEmpty() && !it.equals("<unknown>", ignoreCase = true)
    }
}
