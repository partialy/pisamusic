package cn.partialy.pm.download.task

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.DownloadManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
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

    fun createTask(song: SongInfo, qualityKey: String): DownloadTask {
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
            status = DownloadTaskStatus.PREPARING,
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

    fun updateTarget(taskId: String, fileName: String, targetPath: String) {
        update(taskId) { it.copy(fileName = fileName, targetPath = targetPath) }
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
        DownloadManager.getInstance(context).cancel(taskId)
        markCancelled(taskId)
    }

    suspend fun removeTasks(ids: Set<String>, deleteFiles: Boolean): DownloadTaskRemovalResult {
        if (ids.isEmpty()) return DownloadTaskRemovalResult(0, emptyList())
        val snapshot = tasks.value.filter { it.id in ids }
        removingIds += ids
        snapshot.filter { it.status.isActive }.forEach {
            DownloadManager.getInstance(context).cancel(it.id)
        }
        return withContext(databaseDispatcher) {
            try {
                val failedPaths = mutableListOf<String>()
                val removableIds = snapshot.mapNotNull { task ->
                    val taskFailures = if (deleteFiles) deleteRecordedFiles(task) else emptyList()
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
                refreshFromDatabase()
                removingIds.removeAll(ids)
                snapshot.filter { it.id !in removableIds && it.status.isActive }
                    .forEach { markCancelled(it.id) }
                DownloadTaskRemovalResult(removed, failedPaths)
            } finally {
                removingIds.removeAll(ids)
            }
        }
    }

    private fun update(taskId: String, transform: (DownloadTask) -> DownloadTask) {
        if (taskId in removingIds || taskId in removedIds) return
        val changed = synchronized(stateLock) {
            val current = _tasks.value.firstOrNull { it.id == taskId } ?: return
            transform(current).copy(updatedAt = System.currentTimeMillis()).also { changed ->
                _tasks.value = (_tasks.value.filterNot { it.id == taskId } + changed)
                    .sortedByDescending(DownloadTask::updatedAt)
            }
        }
        persist(changed)
    }

    private fun publish(task: DownloadTask) {
        synchronized(stateLock) {
            _tasks.value = (_tasks.value.filterNot { it.id == task.id } + task)
                .sortedByDescending(DownloadTask::updatedAt)
        }
    }

    private fun persist(task: DownloadTask) {
        scope.launch {
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
    }

    private fun refreshFromDatabase() {
        val loaded = helper.readableDatabase.query(
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
        synchronized(stateLock) {
            _tasks.value = loaded
        }
    }

    private fun loadInitialTasks(): List<DownloadTask> {
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
