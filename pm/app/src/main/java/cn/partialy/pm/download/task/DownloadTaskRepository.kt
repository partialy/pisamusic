package cn.partialy.pm.download.task

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.download.MetadataWriteResult
import cn.partialy.pm.download.MetadataWriteStatus
import cn.partialy.pm.download.AudioFileTransaction
import cn.partialy.pm.utils.DownloadPathManager
import cn.partialy.pm.utils.LocalMediaIndexDbStore
import cn.partialy.pm.model.SongType
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray

@Singleton
class DownloadTaskRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val helper = DownloadTaskDbOpenHelper(context)
    private val databaseDispatcher = Executors.newSingleThreadExecutor().asCoroutineDispatcher()
    private val scope = CoroutineScope(SupervisorJob() + databaseDispatcher)
    private val stateLock = Any()
    private val removingIds = ConcurrentHashMap.newKeySet<String>()
    private val removedIds = ConcurrentHashMap.newKeySet<String>()
    private val _tasks = MutableStateFlow(loadInitialTasks())
    val tasks: StateFlow<List<DownloadTask>> = _tasks.asStateFlow()

    internal var stopExecution: (String) -> Unit = {}
    internal var awaitExecution: suspend (String) -> Unit = {}

    fun find(taskId: String): DownloadTask? = tasks.value.firstOrNull { it.id == taskId }

    /** 原子发布排队任务，避免重复点击创建双份。 */
    fun enqueueTask(song: SongInfo, qualityKey: String): DownloadTask? = synchronized(stateLock) {
        if (_tasks.value.any {
            it.source == song.type && it.songId == song.id && it.qualityKey == qualityKey &&
                (it.status.isActive || (it.status == DownloadTaskStatus.COMPLETED && it.targetPath?.let(::File)?.isFile == true))
        }) return@synchronized null
        createTask(song, qualityKey)
    }

    private fun createTask(song: SongInfo, qualityKey: String): DownloadTask {
        val now = System.currentTimeMillis()
        val task = DownloadTask(
            id = UUID.randomUUID().toString(),
            songId = song.id,
            source = song.type,
            title = song.name,
            artist = song.artist,
            album = song.album,
            coverUrl = song.coverUrl,
            qualityKey = qualityKey,
            fileName = null,
            targetPath = null,
            sidecarPaths = emptyList(),
            status = DownloadTaskStatus.QUEUED,
            progress = 0,
            downloadedBytes = 0L,
            totalBytes = 0L,
            errorMessage = null,
            createdAt = now,
            updatedAt = now,
            completedAt = null,
        )
        publish(task)
        persist(task)
        return task
    }

    fun claim(taskId: String): Boolean = synchronized(stateLock) {
        if (find(taskId)?.status != DownloadTaskStatus.QUEUED || taskId in removingIds || taskId in removedIds) return@synchronized false
        update(taskId) { it.copy(status = DownloadTaskStatus.PREPARING) }
        true
    }

    fun updateQuality(taskId: String, qualityKey: String) {
        update(taskId) { it.copy(qualityKey = qualityKey) }
    }

    fun updateTarget(taskId: String, fileName: String, targetPath: String) {
        update(taskId) { it.copy(fileName = fileName, targetPath = targetPath) }
    }

    /** 内核结束前补记真实产物；仅更新路径，不允许取消任务恢复为成功。 */
    fun recordProducedFiles(taskId: String, targetPath: String, sidecarPaths: List<String>) {
        synchronized(stateLock) {
            if (taskId in removedIds) return
            val current = find(taskId) ?: return
            val changed = current.copy(targetPath = targetPath, sidecarPaths = sidecarPaths.distinct(), updatedAt = System.currentTimeMillis())
            _tasks.value = _tasks.value.map { if (it.id == taskId) changed else it }
            persist(changed)
        }
    }

    fun markDownloading(taskId: String) {
        update(taskId) { it.copy(status = DownloadTaskStatus.DOWNLOADING, errorMessage = null) }
    }

    fun updateProgress(taskId: String, progress: Int, downloadedBytes: Long, totalBytes: Long) {
        update(taskId) {
            it.copy(
                status = DownloadTaskStatus.DOWNLOADING,
                progress = progress.coerceIn(0, 100),
                downloadedBytes = downloadedBytes.coerceAtLeast(0L),
                totalBytes = totalBytes.coerceAtLeast(0L),
            )
        }
    }

    fun markProcessing(taskId: String, targetPath: String) {
        update(taskId) {
            it.copy(
                status = DownloadTaskStatus.PROCESSING,
                targetPath = targetPath,
                progress = 100,
            )
        }
    }

    fun markCompleted(taskId: String, targetPath: String, sidecarPaths: List<String>) {
        val now = System.currentTimeMillis()
        update(taskId) {
            it.copy(
                status = DownloadTaskStatus.COMPLETED,
                progress = 100,
                downloadedBytes = File(targetPath).length().coerceAtLeast(it.downloadedBytes),
                totalBytes = File(targetPath).length().coerceAtLeast(it.totalBytes),
                targetPath = targetPath,
                sidecarPaths = sidecarPaths.distinct(),
                errorMessage = null,
                completedAt = now,
            )
        }
    }

    /** 元数据状态独立于主下载状态，允许在 COMPLETED 之后更新。 */
    fun updateMetadata(taskId: String, result: MetadataWriteResult) {
        synchronized(stateLock) {
            if (taskId in removingIds || taskId in removedIds) return
            val task = find(taskId) ?: return
            val changed = task.copy(
                metadataStatus = result.status,
                metadataWarning = result.warning?.take(500),
                updatedAt = System.currentTimeMillis(),
            )
            _tasks.value = (_tasks.value.filterNot { it.id == taskId } + changed)
                .sortedByDescending(DownloadTask::updatedAt)
            persist(changed)
        }
    }

    /** 历史失败任务的音频已存在，修复后无需重新下载。 */
    fun recoverAsCompleted(taskId: String, targetPath: String, sidecarPaths: List<String>) {
        synchronized(stateLock) {
            if (taskId in removedIds || taskId in removingIds) return
            val current = find(taskId) ?: return
            if (current.status != DownloadTaskStatus.FAILED || !File(targetPath).isFile) return
            val changed = current.copy(
                status = DownloadTaskStatus.COMPLETED,
                targetPath = targetPath,
                sidecarPaths = sidecarPaths,
                progress = 100,
                errorMessage = null,
                completedAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis(),
            )
            _tasks.value = (_tasks.value.filterNot { it.id == taskId } + changed)
                .sortedByDescending(DownloadTask::updatedAt)
            persist(changed)
        }
    }

    fun markFailed(taskId: String, errorMessage: String?) {
        update(taskId) {
            if (it.status == DownloadTaskStatus.CANCELLED) it else it.copy(
                status = DownloadTaskStatus.FAILED,
                errorMessage = errorMessage?.take(500),
            )
        }
    }

    fun markCancelled(taskId: String) {
        update(taskId) {
            it.copy(status = DownloadTaskStatus.CANCELLED, errorMessage = null)
        }
    }

    fun cancelTask(taskId: String) {
        val current = find(taskId) ?: return
        if (!current.status.isActive) return
        markCancelled(taskId)
        stopExecution(taskId)
    }

    suspend fun removeTasks(ids: Set<String>, deleteFiles: Boolean): DownloadTaskRemovalResult {
        if (ids.isEmpty()) return DownloadTaskRemovalResult(0, emptyList())
        val snapshot = tasks.value.filter { it.id in ids }
        snapshot.filter { it.status.isActive }.forEach { cancelTask(it.id) }
        removingIds += ids
        // 等待下载内核及 sidecar 停止写入后再删文件。
        return withContext(NonCancellable) {
            snapshot.forEach { awaitExecution(it.id) }
            withContext(databaseDispatcher) {
                try {
                    val finalSnapshot = tasks.value.filter { it.id in ids }
                    val failedPaths = mutableListOf<String>()
                    val removableIds = finalSnapshot.mapNotNull { task ->
                        val sharedFile = tasks.value.any { other ->
                            other.id !in ids && task.targetPath != null && other.targetPath == task.targetPath
                        }
                        val taskFailures = if (deleteFiles && !sharedFile) deleteRecordedFiles(task) else emptyList()
                        failedPaths += taskFailures
                        task.id.takeIf { taskFailures.isEmpty() }
                    }.toSet()
                    val removed = if (removableIds.isEmpty()) {
                        0
                    } else {
                        val placeholders = removableIds.joinToString(",") { "?" }
                        helper.writableDatabase.delete(
                            "download_tasks",
                            "id IN ($placeholders)",
                            removableIds.toTypedArray(),
                        )
                    }
                    removedIds += removableIds
                    synchronized(stateLock) {
                        _tasks.value = _tasks.value.filterNot { it.id in removableIds }
                    }
                    removingIds.removeAll(ids)
                    tasks.value.filter { it.id in ids && it.id !in removableIds }
                        .forEach { persist(it) }
                    DownloadTaskRemovalResult(removed, failedPaths)
                } finally {
                    removingIds.removeAll(ids)
                }
            }
        }
    }

    private fun update(taskId: String, transform: (DownloadTask) -> DownloadTask) {
        synchronized(stateLock) {
            if (taskId in removingIds || taskId in removedIds) return
            val current = _tasks.value.firstOrNull { it.id == taskId } ?: return
            if (!current.status.isActive) return
            val changed = transform(current).copy(updatedAt = System.currentTimeMillis())
            val legal = when (current.status) {
                DownloadTaskStatus.QUEUED -> setOf(DownloadTaskStatus.QUEUED, DownloadTaskStatus.PREPARING, DownloadTaskStatus.FAILED, DownloadTaskStatus.CANCELLED)
                DownloadTaskStatus.PREPARING -> setOf(DownloadTaskStatus.PREPARING, DownloadTaskStatus.DOWNLOADING, DownloadTaskStatus.COMPLETED, DownloadTaskStatus.FAILED, DownloadTaskStatus.CANCELLED)
                DownloadTaskStatus.DOWNLOADING -> setOf(DownloadTaskStatus.DOWNLOADING, DownloadTaskStatus.PROCESSING, DownloadTaskStatus.COMPLETED, DownloadTaskStatus.FAILED, DownloadTaskStatus.CANCELLED)
                DownloadTaskStatus.PROCESSING -> setOf(DownloadTaskStatus.PROCESSING, DownloadTaskStatus.COMPLETED, DownloadTaskStatus.FAILED, DownloadTaskStatus.CANCELLED)
                else -> emptySet()
            }
            if (changed.status !in legal) return
            _tasks.value = (_tasks.value.filterNot { it.id == taskId } + changed)
                .sortedByDescending(DownloadTask::updatedAt)
            persist(changed)
        }
    }

    private fun publish(task: DownloadTask) {
        synchronized(stateLock) {
            _tasks.value = (_tasks.value.filterNot { it.id == task.id } + task)
                .sortedByDescending(DownloadTask::updatedAt)
        }
    }

    private fun persist(task: DownloadTask) {
        scope.launch {
            if (task.id in removedIds || task.id in removingIds) return@launch
            helper.writableDatabase.insertWithOnConflict(
                "download_tasks",
                null,
                task.toContentValues(),
                android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE,
            )
        }
    }

    private fun recoverInterruptedTasks() {
        val now = System.currentTimeMillis()
        val active = DownloadTaskStatus.entries.filter { it.isActive }
        val placeholders = active.joinToString(",") { "?" }
        val values = ContentValues().apply {
            put("status", DownloadTaskStatus.FAILED.name)
            put("error_message", "下载任务因应用重启中断")
            put("updated_at", now)
        }
        helper.writableDatabase.update(
            "download_tasks",
            values,
            "status IN ($placeholders)",
            active.map(DownloadTaskStatus::name).toTypedArray(),
        )
        helper.writableDatabase.execSQL(
            "UPDATE download_tasks SET metadata_status = 'INTERRUPTED' WHERE metadata_status = 'PENDING'",
        )
    }

    private fun loadInitialTasks(): List<DownloadTask> {
        // 包括历史下载目录，避免修改下载路径后遗漏未结束的文件事务。
        val recoveryDirectories = linkedSetOf(File(DownloadPathManager.getDownloadPath(context)))
        runCatching {
            helper.readableDatabase.rawQuery(
                "SELECT DISTINCT target_path FROM download_tasks WHERE target_path IS NOT NULL",
                emptyArray(),
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    File(cursor.getString(0)).parentFile?.let(recoveryDirectories::add)
                }
            }
        }
        recoveryDirectories.forEach { directory ->
            runCatching { AudioFileTransaction.recoverPending(directory) }
        }
        recoverInterruptedTasks()
        return helper.readableDatabase.query(
            "download_tasks",
            null,
            null,
            null,
            null,
            null,
            "updated_at DESC",
        ).use { cursor ->
            buildList {
                while (cursor.moveToNext()) add(cursor.toDownloadTask())
            }
        }
    }

    private fun deleteRecordedFiles(task: DownloadTask): List<String> {
        val target = task.targetPath?.let { runCatching { File(it).canonicalFile }.getOrNull() }
            ?: return emptyList()
        val parent = target.parentFile ?: return listOfNotNull(task.targetPath)
        val failed = mutableListOf<String>()
        val recordedPaths = buildList {
            add(target.path)
            add(target.path + ".part")
            task.sidecarPaths.forEach { rawPath ->
                val sidecar = runCatching { File(rawPath).canonicalFile }.getOrNull()
                if (sidecar == null || sidecar.parentFile != parent) {
                    failed += rawPath
                } else {
                    add(sidecar.path)
                }
            }
        }
        recordedPaths.distinct().forEach { rawPath ->
            val file = runCatching { File(rawPath).canonicalFile }.getOrNull()
            if (file == null) {
                failed += rawPath
            } else if (file.exists() && !file.delete()) {
                failed += rawPath
            }
        }
        if (!target.exists()) {
            runCatching {
                LocalMediaIndexDbStore(context).removeWordLyric(
                    SongInfo(target.absolutePath, SongType.LOCAL, task.title, task.artist, ""),
                )
            }
        }
        return failed
    }

    private fun DownloadTask.toContentValues() = ContentValues().apply {
        put("id", id)
        put("song_id", songId)
        put("source", source.name)
        put("title", title)
        put("artist", artist)
        put("album", album)
        put("cover_url", coverUrl)
        put("quality_key", qualityKey)
        put("file_name", fileName)
        put("target_path", targetPath)
        put("sidecar_paths_json", JSONArray(sidecarPaths).toString())
        put("status", status.name)
        put("progress", progress)
        put("downloaded_bytes", downloadedBytes)
        put("total_bytes", totalBytes)
        put("error_message", errorMessage)
        put("created_at", createdAt)
        put("updated_at", updatedAt)
        put("completed_at", completedAt)
        put("metadata_status", metadataStatus.name)
        put("metadata_warning", metadataWarning)
    }

    private fun Cursor.toDownloadTask(): DownloadTask {
        val sidecars = runCatching {
            val array = JSONArray(getString(getColumnIndexOrThrow("sidecar_paths_json")))
            buildList { repeat(array.length()) { add(array.getString(it)) } }
        }.getOrDefault(emptyList())
        return DownloadTask(
            id = getString(getColumnIndexOrThrow("id")),
            songId = getString(getColumnIndexOrThrow("song_id")),
            source = runCatching {
                SongType.valueOf(getString(getColumnIndexOrThrow("source")))
            }.getOrDefault(SongType.KG),
            title = getString(getColumnIndexOrThrow("title")),
            artist = getString(getColumnIndexOrThrow("artist")),
            album = getNullableString("album"),
            coverUrl = getString(getColumnIndexOrThrow("cover_url")),
            qualityKey = getString(getColumnIndexOrThrow("quality_key")),
            fileName = getNullableString("file_name"),
            targetPath = getNullableString("target_path"),
            sidecarPaths = sidecars,
            status = runCatching {
                DownloadTaskStatus.valueOf(getString(getColumnIndexOrThrow("status")))
            }.getOrDefault(DownloadTaskStatus.FAILED),
            progress = getInt(getColumnIndexOrThrow("progress")),
            downloadedBytes = getLong(getColumnIndexOrThrow("downloaded_bytes")),
            totalBytes = getLong(getColumnIndexOrThrow("total_bytes")),
            errorMessage = getNullableString("error_message"),
            createdAt = getLong(getColumnIndexOrThrow("created_at")),
            updatedAt = getLong(getColumnIndexOrThrow("updated_at")),
            completedAt = getNullableLong("completed_at"),
            metadataStatus = runCatching {
                MetadataWriteStatus.valueOf(getString(getColumnIndexOrThrow("metadata_status")))
            }.getOrDefault(MetadataWriteStatus.UNKNOWN),
            metadataWarning = getNullableString("metadata_warning"),
        )
    }

    private fun Cursor.getNullableString(column: String): String? {
        val index = getColumnIndexOrThrow(column)
        return if (isNull(index)) null else getString(index)
    }

    private fun Cursor.getNullableLong(column: String): Long? {
        val index = getColumnIndexOrThrow(column)
        return if (isNull(index)) null else getLong(index)
    }
}
