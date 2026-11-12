package cn.partialy.pm.download

import android.content.Context
import cn.partialy.pm.download.task.DownloadTask
import cn.partialy.pm.download.task.DownloadTaskRepository
import cn.partialy.pm.download.task.DownloadTaskStatus
import cn.partialy.pm.lyric.LyricFormat
import cn.partialy.pm.lyric.LyricParser
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.utils.AudioMetadataEmbedder
import cn.partialy.pm.utils.AudioMediaScanner
import cn.partialy.pm.utils.AudioSourceTag
import cn.partialy.pm.utils.LocalMediaIndexDbStore
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey

data class AudioRepairSummary(val success: Int, val skipped: Int, val failed: Int)

@Singleton
class AudioMetadataRepairer @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repository: DownloadTaskRepository,
    private val lyricResolver: DownloadLyricResolver,
    private val musicController: MusicController,
) {
    private val repairLock = Mutex()
    private val client = OkHttpClient()
    private val index = LocalMediaIndexDbStore(context)

    suspend fun repairSelected(taskIds: Set<String>): AudioRepairSummary = repairLock.withLock {
        withContext(Dispatchers.IO) {
            var success = 0
            var skipped = 0
            var failed = 0
            for (id in taskIds) {
                currentCoroutineContext().ensureActive()
                val task = repository.find(id)
                if (task == null || task.status != DownloadTaskStatus.COMPLETED && task.status != DownloadTaskStatus.FAILED) {
                    skipped++
                    continue
                }
                val result = try {
                    repairOne(task)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Exception) {
                    MetadataWriteResult(MetadataWriteStatus.FAILED, error.message ?: "歌曲信息修复失败")
                }
                repository.updateMetadata(id, result)
                if (task.status == DownloadTaskStatus.FAILED) {
                    task.targetPath?.takeIf { AudioMetadataVerifier.isReadable(File(it)) }
                        ?.let { repository.recoverAsCompleted(id, it, task.sidecarPaths) }
                }
                when (result.status) {
                    MetadataWriteStatus.SUCCESS -> success++
                    MetadataWriteStatus.SKIPPED -> skipped++
                    else -> failed++
                }
            }
            AudioRepairSummary(success, skipped, failed)
        }
    }

    private suspend fun repairOne(task: DownloadTask): MetadataWriteResult {
        val file = task.targetPath?.let(::File)
            ?: return MetadataWriteResult(MetadataWriteStatus.FAILED, "音频文件路径缺失")
        if (!file.isFile) return MetadataWriteResult(MetadataWriteStatus.FAILED, "音频文件已不存在")
        // KW 仅补来源字段，不开启原来跳过的歌词、封面和普通标签写入。
        val canWriteMetadata = task.source != SongType.KW
        val current = musicController.currentSong.value
        if (current?.type == SongType.LOCAL &&
            runCatching { File(current.id).canonicalFile == file.canonicalFile }.getOrDefault(false)) {
            return MetadataWriteResult(MetadataWriteStatus.SKIPPED, "歌曲正在被播放器使用")
        }
        val ext = file.extension.lowercase()
        if (ext !in setOf("mp3", "flac", "ogg", "wav", "m4a", "wma", "aiff")) {
            return MetadataWriteResult(MetadataWriteStatus.SKIPPED, "当前格式不支持标签修复")
        }
        if (!AudioMetadataVerifier.isReadable(file)) {
            return MetadataWriteResult(MetadataWriteStatus.FAILED, "文件无法读取或当前格式不支持解析")
        }
        val song = SongInfo(task.songId, task.source, task.title, task.artist, task.coverUrl, album = task.album)
        val audio = AudioFileIO.read(file)
        val tag = audio.tag
        fun field(key: FieldKey): String = runCatching { tag?.getFirst(key).orEmpty() }.getOrDefault("")
        fun missing(key: FieldKey): Boolean = field(key).isBlank()
        val writeTags = canWriteMetadata && SettingsPrefs.isWriteTagsEnabled(context)
        val title = task.title.takeIf { writeTags && missing(FieldKey.TITLE) }.orEmpty()
        val artist = task.artist.takeIf { writeTags && missing(FieldKey.ARTIST) }.orEmpty()
        val album = task.album.takeIf { writeTags && missing(FieldKey.ALBUM) }.orEmpty()
        val expectedSource = AudioSourceTag.value(task.source, task.songId)
        val existingSource = AudioSourceTag.read(tag)
        val sourceInfo = expectedSource.takeIf { existingSource == null }
        val sourceConflict = expectedSource != null && existingSource != null && existingSource != expectedSource
        val local = song.copy(id = file.absolutePath, type = SongType.LOCAL)
        val oldLyrics = field(FieldKey.LYRICS)
        val oldParsed = LyricParser.parseBest(oldLyrics, "embedded")
        val oldWord = if (oldParsed.hasWordTiming) {
            val format = oldParsed.format
            DownloadLyricAsset(oldLyrics, if (format == LyricFormat.KRC) "krc" else "yrc")
        } else null
        val writeLyrics = canWriteMetadata && SettingsPrefs.isWriteLyricsEnabled(context)
        val fetched = if (writeLyrics) {
            lyricResolver.resolve(song, true, SettingsPrefs.DownloadLyricMode.Off)
        } else ResolvedDownloadLyrics.NONE
        val sourceWord = if (canWriteMetadata) fetched.originalWordAsset ?: oldWord else null
        // 先持久化旧逐字歌词，确认成功后再允许覆盖旧字段。
        if (sourceWord != null) {
            index.upsertWordLyric(local, sourceWord.text, "repair_${sourceWord.extension}")
        }
        val storedWord = index.getWordLyricIndex(local) != null
        val lyrics = when {
            !writeLyrics -> ""
            oldParsed.hasWordTiming && storedWord ->
                EmbeddedLyricFormatter.standardLrc(null, oldWord)
                    .ifBlank { fetched.embeddedText }
            missing(FieldKey.LYRICS) -> fetched.embeddedText
            else -> ""
        }
        val needCover = canWriteMetadata && ext in setOf("mp3", "flac", "m4a") &&
            SettingsPrefs.isWriteCoverEnabled(context) && tag?.firstArtwork == null
        val coverCandidates = if (needCover) DownloadCoverFetcher.candidates(song) else emptyList()
        val cover = DownloadCoverFetcher.fetch(client, coverCandidates)
        val coverMissing = needCover && coverCandidates.isNotEmpty() && (cover == null || cover.isEmpty())
        val warnings = mutableListOf<String>().apply { addAll(listOfNotNull(
            "封面获取失败".takeIf { coverMissing },
            "已有来源字段与下载记录不同，已保留原值".takeIf { sourceConflict },
        )) }
        if (listOf(title, artist, album, lyrics).all(String::isBlank) &&
            (cover == null || cover.isEmpty()) && sourceInfo == null) {
            AudioMediaScanner.refresh(context, file)
            return if (warnings.isNotEmpty()) MetadataWriteResult(MetadataWriteStatus.PARTIAL, warnings.joinToString("；"))
            else MetadataWriteResult(MetadataWriteStatus.SKIPPED, "没有需要补写的信息")
        }
        repository.updateMetadata(task.id, MetadataWriteResult(MetadataWriteStatus.PENDING))
        withContext(NonCancellable) {
            AudioMetadataEmbedder.embedSafely(file, title, artist, album, lyrics, cover, sourceInfo)?.let(warnings::add)
            AudioMediaScanner.refresh(context, file)
        }
        return if (warnings.isNotEmpty()) MetadataWriteResult(MetadataWriteStatus.PARTIAL, warnings.joinToString("；"))
            else MetadataWriteResult(MetadataWriteStatus.SUCCESS)
    }
}
