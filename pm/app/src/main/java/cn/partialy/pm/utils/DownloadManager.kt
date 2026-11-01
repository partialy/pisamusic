package cn.partialy.pm.utils

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import cn.partialy.pm.R
import cn.partialy.pm.download.LyricSidecarWriteResult
import cn.partialy.pm.download.LyricSidecarWriter
import cn.partialy.pm.download.ResolvedDownloadLyrics
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.JavaUtils.JDownloadManager
import cn.partialy.pm.utils.SettingsPrefs
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.abs

class DownloadManager private constructor(private val context: Context) {

    /**
     * 下载状态回调接口
     */
    interface DownloadCallback {
        fun onProgress(progress: Int, downloadedSize: Long, totalSize: Long)
        fun onProcessing(file: File) = Unit
        fun onProducedFiles(file: File, sidecarPaths: List<String>) = Unit
        fun onSuccess(file: File, lyricResult: LyricSidecarWriteResult)
        fun onCancelled() = Unit
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
    fun startDownload(
        taskId: String,
        url: String,
        fileName: String,
        songInfo: SongInfo,
        resolvedLyrics: ResolvedDownloadLyrics = ResolvedDownloadLyrics.NONE,
        targetDirectory: String = DownloadPathManager.getDownloadPath(context),
        callback: DownloadCallback,
    ) {
        val embedMetadata = songInfo.type != SongType.KW
        val coverUrl = if (embedMetadata && SettingsPrefs.isWriteCoverEnabled(context)) {
            resolveEmbedCoverUrl(songInfo)
        } else {
            null
        }
        val title = if (embedMetadata && SettingsPrefs.isWriteTagsEnabled(context)) songInfo.name else ""
        val artist = if (embedMetadata && SettingsPrefs.isWriteTagsEnabled(context)) songInfo.artist else ""
        val album = if (embedMetadata && SettingsPrefs.isWriteTagsEnabled(context)) (songInfo.album ?: "") else ""
        val lyric = if (embedMetadata && SettingsPrefs.isWriteLyricsEnabled(context)) {
            resolvedLyrics.embeddedText
        } else {
            ""
        }

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
                val file = File(filePath)
                if (cancelledTaskIds.contains(taskId)) {
                    finishCancelled(taskId, callback)
                    return
                }
                mainHandler.post { callback.onProcessing(file) }
                sidecarExecutor.execute {
                    if (cancelledTaskIds.contains(taskId)) {
                        finishCancelled(taskId, callback)
                        return@execute
                    }
                    val lyricResult = LyricSidecarWriter.write(file, resolvedLyrics)
                    mainHandler.post {
                        callback.onProducedFiles(file, lyricResult.savedPaths)
                        if (cancelledTaskIds.remove(taskId)) {
                            callback.onCancelled()
                            return@post
                        }
                        // 确保最终进度为100%
                        callback.onProgress(100, file.length(), file.length())
                        callback.onSuccess(file, lyricResult)
                    }
                }
            }

            override fun onError(error: String) {
                Handler(Looper.getMainLooper()).post {
                    cancelledTaskIds.remove(taskId)
                    callback.onFailure(Exception(error))
                }
            }

            override fun onCancelled() {
                finishCancelled(taskId, callback)
            }
        }

        JDownloadManager.download(
            taskId,
            context,
            url,
            fileName,
            targetDirectory,
            coverUrl,
            embedMetadata,
            title,
            artist,
            album,
            lyric,
            javaCallback,
        )
    }

    fun cancel(taskId: String) {
        cancelledTaskIds += taskId
        JDownloadManager.cancel(taskId)
    }

    private fun finishCancelled(taskId: String, callback: DownloadCallback) {
        cancelledTaskIds.remove(taskId)
        mainHandler.post { callback.onCancelled() }
    }

    private fun resolveEmbedCoverUrl(songInfo: SongInfo): String? = when (songInfo.type) {
        SongType.KW, SongType.LOCAL -> null
        SongType.KG, SongType.WY, SongType.CLOUD -> SongCoverUrl
            .getSongCover(songInfo, SongCoverUrl.SIZE_MEDIUM)
            .takeIf { it.isNotBlank() }
    }

    fun getDownloadedFiles(): List<SongInfo> {
        // 获取下载的文件
        val downloadDir = File(DownloadPathManager.getDownloadPath(context))
        val files = downloadDir.listFiles { file ->
            file.isFile && file.extension.lowercase() in AUDIO_FILE_EXTENSIONS
        }
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
                var album = context.getString(R.string.download_unknown_album)

                audioFile.tag?.let { tag ->
                    title = tag.getFirst(FieldKey.TITLE).takeIf { it.isNotEmpty() } ?: fileSongName
                    artist = tag.getFirst(FieldKey.ARTIST).takeIf { it.isNotEmpty() } ?: fileSinger
                    album = tag.getFirst(FieldKey.ALBUM).takeIf { it.isNotEmpty() }
                        ?: context.getString(R.string.download_unknown_album)
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
        private val AUDIO_FILE_EXTENSIONS = setOf(
            "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "ape", "wma", "aiff",
        )
        private val mainHandler = Handler(Looper.getMainLooper())
        private val sidecarExecutor = Executors.newSingleThreadExecutor()
        private val cancelledTaskIds = ConcurrentHashMap.newKeySet<String>()

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
