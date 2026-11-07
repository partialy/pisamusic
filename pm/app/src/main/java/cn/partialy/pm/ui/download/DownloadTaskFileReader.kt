package cn.partialy.pm.ui.download

import android.content.Context
import cn.partialy.pm.R
import cn.partialy.pm.download.DownloadFileLocks
import cn.partialy.pm.download.task.DownloadTask
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.AudioEmbeddedArtReader
import cn.partialy.pm.utils.SongCoverUrl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import java.io.File

/** 文件读取结果只用于当前操作，不回写任务或本地曲库。durationMs 为毫秒。 */
data class DownloadTaskFileInfo(
    val song: SongInfo,
    val readable: Boolean,
    val exists: Boolean,
    val sizeBytes: Long?,
    val durationMs: Long?,
    val error: String?,
)

object DownloadTaskFileReader {
    suspend fun read(context: Context, task: DownloadTask): DownloadTaskFileInfo = withContext(Dispatchers.IO) {
        val file = task.targetPath?.takeIf(String::isNotBlank)?.let(::File)
        val fallback = SongInfo(
            id = file?.absolutePath.orEmpty(), type = SongType.LOCAL,
            name = task.title, artist = task.artist,
            coverUrl = SongCoverUrl.getRemoteCover(task.source.name.lowercase(), task.coverUrl, SongCoverUrl.SIZE_SMALL),
            album = task.album,
        )
        val historicalSize = task.totalBytes.takeIf { it > 0 }
        if (file == null) return@withContext DownloadTaskFileInfo(fallback, false, false, historicalSize, null,
            context.getString(R.string.download_details_file_missing))
        try {
            DownloadFileLocks.withFile(file) {
                val exists = file.isFile
                if (!exists) {
                    DownloadTaskFileInfo(fallback, false, false, historicalSize, null,
                        context.getString(R.string.download_details_file_missing))
                } else {
                    val size = file.length().takeIf { it >= 0 } ?: historicalSize
                    try {
                        check(file.canRead() && (size ?: 0) > 0)
                        val audio = AudioFileIO.read(file)
                        val header = audio.audioHeader
                        check(header != null)
                        val tag = audio.tag
                        fun field(key: FieldKey): String? = runCatching { tag?.getFirst(key)?.takeIf(String::isNotBlank) }.getOrNull()
                        val seconds = header.trackLength.takeIf { it > 0 }
                        val song = fallback.copy(
                            name = field(FieldKey.TITLE) ?: fallback.name,
                            artist = field(FieldKey.ARTIST) ?: fallback.artist,
                            album = field(FieldKey.ALBUM) ?: fallback.album,
                            embeddedCoverArt = AudioEmbeddedArtReader.readEmbeddedCoverBytesWithTag(context, file, tag),
                            // 与现有 DownloadManager.getDownloadedFiles 的 LOCAL 时长保持一致。
                            duration = seconds,
                        )
                        DownloadTaskFileInfo(song, true, true, size, seconds?.toLong()?.times(1000), null)
                    } catch (_: Exception) {
                        DownloadTaskFileInfo(fallback, false, true, size, null,
                            context.getString(R.string.download_details_file_unreadable))
                    }
                }
            }
        } catch (_: Exception) {
            DownloadTaskFileInfo(fallback, false, file.isFile, historicalSize, null,
                context.getString(R.string.download_details_file_unreadable))
        }
    }
}
