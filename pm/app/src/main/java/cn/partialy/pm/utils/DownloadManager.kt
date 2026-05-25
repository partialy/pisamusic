package cn.partialy.pm.utils

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.JavaUtils.JDownloadManager
import cn.partialy.pm.utils.SettingsPrefs
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import java.io.File
import kotlin.math.abs

class DownloadManager private constructor(private val context: Context) {

    /**
     * 下载状态回调接口
     */
    interface DownloadCallback {
        fun onProgress(progress: Int, downloadedSize: Long, totalSize: Long)
        fun onSuccess(file: File)
        fun onFailure(e: Exception)
    }

    /**
     * 开始下载
     * @param url 下载地址
     * @param fileName 保存的文件名
     * @param songInfo 歌曲信息
     * @param callback 下载回调
     * @return 下载任务的唯一标识
     */
    fun startDownload(url: String, fileName: String, songInfo: SongInfo, callback: DownloadCallback) {
        val embedMetadata = songInfo.type != SongType.KW
        val coverUrl = if (embedMetadata && SettingsPrefs.isWriteCoverEnabled(context)) {
            resolveEmbedCoverUrl(songInfo)
        } else {
            null
        }
        val title = if (embedMetadata && SettingsPrefs.isWriteTagsEnabled(context)) songInfo.name else ""
        val artist = if (embedMetadata && SettingsPrefs.isWriteTagsEnabled(context)) songInfo.artist else ""
        val album = if (embedMetadata && SettingsPrefs.isWriteTagsEnabled(context)) (songInfo.album ?: "") else ""
        val lyric = if (embedMetadata && SettingsPrefs.isWriteLyricsEnabled(context)) songInfo.lyric.orEmpty() else ""

        // 创建 Java 回调适配器
        val javaCallback = object : JDownloadManager.DownloadCallback {
            private var lastUpdateTime = 0L
            private var lastProgress = -1

            override fun onProgress(progress: Int, downloadedBytes: Long, totalBytes: Long) {
                val currentTime = System.currentTimeMillis()
                // 控制更新频率：每200ms或进度变化超过1%时更新
                if (currentTime - lastUpdateTime > 200 || abs(progress - lastProgress) > 1) {
                    lastProgress = progress
                    lastUpdateTime = currentTime
                    Handler(Looper.getMainLooper()).post {
                        callback.onProgress(
                            progress = progress,
                            downloadedSize = downloadedBytes,
                            totalSize = totalBytes
                        )
                    }
                }
            }

            override fun onSuccess(filePath: String) {
                // 确保最终进度为100%
                Handler(Looper.getMainLooper()).post {
                    callback.onProgress(100, File(filePath).length(), File(filePath).length())
                    callback.onSuccess(File(filePath))
                }
            }

            override fun onError(error: String) {
                Handler(Looper.getMainLooper()).post {
                    callback.onFailure(Exception(error))
                }
            }
        }

        JDownloadManager.download(
            context,
            url,
            fileName,
            coverUrl,
            embedMetadata,
            title,
            artist,
            album,
            lyric,
            javaCallback,
        )
    }

    private fun resolveEmbedCoverUrl(songInfo: SongInfo): String? = when (songInfo.type) {
        SongType.KW, SongType.LOCAL -> null
        SongType.KG, SongType.WY -> SongCoverUrl
            .getSongCover(songInfo, SongCoverUrl.SIZE_MEDIUM)
            .takeIf { it.isNotBlank() }
    }

    fun getDownloadedFiles(): List<SongInfo> {
        // 获取下载的文件
        val downloadDir = File(DownloadPathManager.getDownloadPath(context))
        val files = downloadDir.listFiles()
        val list : MutableList<SongInfo> = mutableListOf()
        files?.map { file ->
            println(file.name)
            try {
                // 读取元数据
                val audioFile = AudioFileIO.read(file)
                
                // 更安全的文件名解析
                val fileNameParts = file.name.split(" - ", limit = 2)
                val (fileSinger, fileNameWithExt) = if (fileNameParts.size == 2) {
                    fileNameParts[0] to fileNameParts[1]
                } else {
                    "" to file.name
                }
                
                val fileSongName = fileNameWithExt.substringBeforeLast(".")
                
                var title = fileSongName
                var artist = fileSinger
                var album = "未知专辑"

                audioFile.tag?.let { tag ->
                    title = tag.getFirst(FieldKey.TITLE).takeIf { it.isNotEmpty() } ?: fileSongName
                    artist = tag.getFirst(FieldKey.ARTIST).takeIf { it.isNotEmpty() } ?: fileSinger
                    album = tag.getFirst(FieldKey.ALBUM).takeIf { it.isNotEmpty() } ?: "未知专辑"
                }

                val coverBytes = AudioEmbeddedArtReader.readEmbeddedCoverBytesWithTag(
                    context,
                    file,
                    audioFile.tag,
                )

                val duration = audioFile.audioHeader.trackLength
                val id = file.path

                list.add(
                    SongInfo(
                        id = id,
                        name = title,
                        type = SongType.LOCAL,
                        artist = artist,
                        album = album,
                        coverUrl = "",
                        embeddedCoverArt = coverBytes,
                        duration = duration
                    )
                )
            } catch (e: Exception) {
                e.printStackTrace()
                println(e)
            }
        }
        list.sortBy { it.name }
        return list
    }

    companion object {
        @SuppressLint("StaticFieldLeak")
        @Volatile
        private var instance: DownloadManager? = null

        fun getInstance(context: Context): DownloadManager {
            return instance ?: synchronized(this) {
                instance ?: DownloadManager(context.applicationContext).also { instance = it }
            }
        }
    }
}
