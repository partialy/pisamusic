package cn.partialy.pm.download.task

import cn.partialy.pm.model.SongType
import cn.partialy.pm.player.MusicController
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

data class DownloadDeletionPreview(val count: Int, val totalBytes: Long)

/** 单项、多选和清除全部共享确认统计与文件占用保护。 */
@Singleton
class DeleteDownloadTasksUseCase @Inject constructor(
    private val repository: DownloadTaskRepository,
    private val musicController: MusicController,
) {
    private val deletion = Mutex()
    suspend fun preview(ids: Set<String>): DownloadDeletionPreview = withContext(Dispatchers.IO) {
        val tasks = repository.tasks.value.filter { it.id in ids }
        val files = tasks.mapNotNull { task -> task.targetPath?.let { runCatching { File(it).canonicalFile }.getOrNull() } }.distinctBy { it.path }
        DownloadDeletionPreview(tasks.size, files.sumOf { if (it.isFile && it.canRead()) it.length() else 0L })
    }
    suspend fun execute(ids: Set<String>, deleteFiles: Boolean): DownloadTaskRemovalResult = deletion.withLock {
        repository.removeTasks(ids.toSet(), deleteFiles) { path ->
            // 仓库在最终文件锁内调用；暂停的播放器也持有文件，不能仅检查 isPlaying。
            musicController.currentSong.value?.takeIf { it.type == SongType.LOCAL }?.let {
                runCatching { File(it.id).canonicalPath == path }.getOrDefault(true)
            } == true
        }
    }
}
