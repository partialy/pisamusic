package cn.partialy.pm.download.task

import android.content.Context
import android.util.Log
import cn.partialy.pm.download.*
import cn.partialy.pm.model.*
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.utils.DownloadManager
import cn.partialy.pm.utils.DownloadPathManager
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

data class DownloadEnqueueSummary(
    val enqueuedKeys: Set<String>,
    val skippedKeys: Set<String>,
    val failedKeys: Set<String>,
)

/** 仅保证进程存活期间执行；两个 FIFO worker 的槽位涵盖取链到文件处理全流程。 */
@Singleton
class DownloadQueueCoordinator @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repository: DownloadTaskRepository,
    private val urlResolver: DownloadUrlResolver,
    private val lyricResolver: DownloadLyricResolver,
) {
    private data class Request(val taskId: String, val song: SongInfo, val choice: DownloadQualityChoice)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val queue = Channel<Request>(Channel.UNLIMITED)
    private val enqueueLock = Mutex()
    private val pathLock = Any()
    private val requests = ConcurrentHashMap<String, Request>()
    private val executions = ConcurrentHashMap<String, Job>()
    private val kernelIds = ConcurrentHashMap.newKeySet<String>()
    private val identityLocks = ConcurrentHashMap<String, Mutex>()

    init {
        repository.stopExecution = { id ->
            executions[id]?.cancel()
            if (id in kernelIds) DownloadManager.getInstance(context).cancel(id)
        }
        repository.awaitExecution = { id -> executions[id]?.join(); Unit }
        repeat(2) {
            scope.launch {
                for (request in queue) {
                    val job = scope.launch(start = CoroutineStart.LAZY) { execute(request) }
                    executions[request.taskId] = job
                    job.start()
                    job.join()
                    executions.remove(request.taskId, job)
                    requests.remove(request.taskId)
                }
            }
        }
    }

    suspend fun enqueue(songs: List<SongInfo>, choice: DownloadQualityChoice): DownloadEnqueueSummary =
        scope.async {
            enqueueLock.withLock {
                val enqueued = linkedSetOf<String>()
                val skipped = linkedSetOf<String>()
                val failed = linkedSetOf<String>()
                for (song in songs.distinctBy { "${it.type}:${it.id}" }) {
                    val key = "${song.type}:${song.id}"
                    val session = AccountSessionStore.read(context)
                    val access = MusicQualityAccessState(session.loggedIn, session.vipActive)
                    if (song.id.isBlank() || !song.playable || !MusicQualityAccessPolicy.isChoiceAllowed(song.type, choice, access)) {
                        failed += key
                        continue
                    }
                    val duplicate = requests.values.any {
                        it.song.type == song.type && it.song.id == song.id && it.choice == choice &&
                            repository.find(it.taskId)?.status?.isActive == true
                    }
                    val task = if (duplicate) null else repository.enqueueTask(song, choice.toPlaybackQualityKey())
                    if (task == null) {
                        skipped += key
                    } else {
                        val request = Request(task.id, song.copy(embeddedCoverArt = null, lyric = null), choice)
                        requests[task.id] = request
                        queue.send(request)
                        enqueued += key
                    }
                    yield()
                }
                DownloadEnqueueSummary(enqueued, skipped, failed)
            }
        }.await()

    suspend fun retry(task: DownloadTask): DownloadEnqueueSummary {
        val choice = playbackQualityChoiceFromKey(task.qualityKey)
            ?: return DownloadEnqueueSummary(emptySet(), emptySet(), setOf("${task.source}:${task.songId}"))
        return enqueue(listOf(SongInfo(task.songId, task.source, task.title, task.artist, task.coverUrl, album = task.album)), choice)
    }

    private suspend fun execute(request: Request) {
        if (!repository.claim(request.taskId)) return
        try {
            val lyrics = try {
                lyricResolver.resolve(request.song, SettingsPrefs.isWriteLyricsEnabled(context), SettingsPrefs.getDownloadLyricMode(context))
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                Log.w("DownloadQueue", "source=${request.song.type} id=${request.song.id} stage=lyrics status=warning")
                ResolvedDownloadLyrics.NONE
            }
            currentCoroutineContext().ensureActive()
            val session = AccountSessionStore.read(context)
            val resource = urlResolver.resolve(request.song, request.choice, MusicQualityAccessState(session.loggedIn, session.vipActive))
            repository.updateQuality(request.taskId, resource.choice.toPlaybackQualityKey())
            val identity = "${request.song.type}:${request.song.id}:${resource.choice.toPlaybackQualityKey()}"
            // 两个不同请求档位回退为同一真实档位时，共享文件也必须串行核查。
            identityLocks.getOrPut(identity) { Mutex() }.withLock {
                currentCoroutineContext().ensureActive()
                val existing = repository.tasks.value.firstOrNull {
                    it.id != request.taskId && it.source == request.song.type && it.songId == request.song.id &&
                        it.qualityKey == resource.choice.toPlaybackQualityKey() && it.status == DownloadTaskStatus.COMPLETED &&
                        it.targetPath?.let(::File)?.isFile == true
                }
                if (existing != null) {
                    repository.updateTarget(request.taskId, existing.fileName.orEmpty(), existing.targetPath!!)
                    repository.markCompleted(request.taskId, existing.targetPath, existing.sidecarPaths)
                    return@withLock
                }
                val target = reserveTarget(request, resource.extension)
                repository.updateTarget(request.taskId, target.name, target.absolutePath)
                download(request, resource, target, lyrics)
            }
        } catch (error: CancellationException) {
            repository.markCancelled(request.taskId)
        } catch (error: Exception) {
            val kind = (error as? DownloadResolutionException)?.kind ?: DownloadFailureKind.STORAGE
            repository.markFailed(request.taskId, kind.description)
            Log.w("DownloadQueue", "source=${request.song.type} id=${request.song.id} quality=${request.choice.toPlaybackQualityKey()} stage=execute errorKind=$kind")
        }
    }

    private fun reserveTarget(request: Request, extension: String): File = synchronized(pathLock) {
        val song = request.song
        val rawBase = when (SettingsPrefs.getFileNamingRule(context)) {
            SettingsPrefs.FileNamingRule.TitleDashArtist -> "${song.name} - ${song.artist}"
            SettingsPrefs.FileNamingRule.ArtistDashTitle -> "${song.artist} - ${song.name}"
        }
        val base = rawBase.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_").trim().trimEnd('.').take(140).ifBlank { "music" }
        val directory = File(DownloadPathManager.getDownloadPath(context))
        // 歌词按音频 basename 命名，MP3/FLAC 也不能共享同一命名域。
        val occupiedBases = directory.listFiles().orEmpty().filter { it.isFile }
            .mapTo(hashSetOf()) { downloadTargetBasename(it.name) }
        repository.tasks.value.filter { it.id != request.taskId }.forEach { task ->
            task.targetPath?.let(::File)?.takeIf { it.parentFile?.absolutePath == directory.absolutePath }
                ?.let { occupiedBases += downloadTargetBasename(it.name) }
        }
        fun occupied(file: File) = downloadTargetBasename(file.name) in occupiedBases
        var target = File(directory, "$base.$extension")
        if (occupied(target)) {
            val hash = MessageDigest.getInstance("SHA-256").digest(song.id.toByteArray()).take(5).joinToString("") { "%02x".format(it) }
            val suffix = "${song.type.name.lowercase()}-$hash"
            target = File(directory, "$base [$suffix].$extension")
            var index = 2
            while (occupied(target)) target = File(directory, "$base [$suffix-${index++}].$extension")
        }
        // 锁内写入路径保留，另一个 worker 不能选中同一尚未创建的文件。
        repository.updateTarget(request.taskId, target.name, target.absolutePath)
        target
    }

    private suspend fun download(request: Request, resource: ResolvedDownloadUrl, target: File, lyrics: ResolvedDownloadLyrics) {
        val id = request.taskId
        currentCoroutineContext().ensureActive()
        val session = AccountSessionStore.read(context)
        if (!MusicQualityAccessPolicy.isChoiceAllowed(request.song.type, resource.choice, MusicQualityAccessState(session.loggedIn, session.vipActive))) {
            throw DownloadResolutionException(DownloadFailureKind.ACCESS)
        }
        kernelIds += id
        try {
            // 取消后仍等待内核最终回调，不能提前释放并发槽位或删除正在处理的文件。
            withContext(NonCancellable) {
                if (repository.find(id)?.status?.isActive != true) return@withContext
                val finished = CompletableDeferred<Unit>()
                repository.markDownloading(id)
                DownloadManager.getInstance(context).startDownload(
                    taskId = id, url = resource.url, fileName = target.name, songInfo = request.song,
                    resolvedLyrics = lyrics, targetDirectory = target.parentFile!!.absolutePath,
                    callback = object : DownloadManager.DownloadCallback {
                        override fun onProgress(progress: Int, downloadedSize: Long, totalSize: Long) {
                            repository.updateProgress(id, progress, downloadedSize, totalSize)
                        }
                        override fun onProcessing(file: File) = repository.markProcessing(id, file.absolutePath)
                        override fun onProducedFiles(file: File, sidecarPaths: List<String>) = repository.recordProducedFiles(id, file.absolutePath, sidecarPaths)
                        override fun onSuccess(file: File, lyricResult: LyricSidecarWriteResult) {
                            repository.markCompleted(id, file.absolutePath, lyricResult.savedPaths)
                            finished.complete(Unit)
                        }
                        override fun onCancelled() { repository.markCancelled(id); finished.complete(Unit) }
                        override fun onFailure(e: Exception) {
                            repository.markFailed(id, DownloadFailureKind.STORAGE.description)
                            finished.complete(Unit)
                        }
                    },
                )
                finished.await()
            }
        } finally {
            kernelIds -= id
        }
    }
}
