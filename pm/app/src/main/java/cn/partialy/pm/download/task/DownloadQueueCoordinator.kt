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
    val completedSkippedKeys: Set<String> = emptySet(),
)

/** 仅保证进程存活期间执行；两个 FIFO worker 的槽位涵盖取链到文件处理全流程。 */
@Singleton
class DownloadQueueCoordinator @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repository: DownloadTaskRepository,
    private val urlResolver: DownloadUrlResolver,
    private val lyricResolver: DownloadLyricResolver,
    private val repairer: javax.inject.Provider<AudioMetadataRepairer>,
) {
    private data class Request(val taskId: String, val song: SongInfo, val choice: DownloadQualityChoice, val generation: Long = 0, val exactQuality: Boolean = false)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val queue = Channel<Request>(Channel.UNLIMITED)
    private val enqueueLock = Mutex()
    private val pathLock = Any()
    private val requests = ConcurrentHashMap<String, Request>()
    private val executions = ConcurrentHashMap<String, Job>()
    private val kernelTokens = ConcurrentHashMap<String, String>()
    private val identityLocks = ConcurrentHashMap<String, Mutex>()

    init {
        repository.stopExecution = { id ->
            executions[id]?.cancel()
            kernelTokens[id]?.let { DownloadManager.getInstance(context).cancel(it) }
        }
        repository.awaitExecution = { id -> executions[id]?.join(); Unit }
        repeat(2) {
            scope.launch {
                for (request in queue) {
                    if (!repository.claim(request.taskId, request.generation)) {
                        // 暂停/取消/重试后的旧请求不可再占用请求索引或参与重复判定。
                        requests.remove(request.taskId, request)
                        continue
                    }
                    val job = scope.launch(start = CoroutineStart.LAZY) { execute(request) }
                    executions[request.taskId] = job
                    job.start()
                    job.join()
                    executions.remove(request.taskId, job)
                    requests.remove(request.taskId, request)
                }
            }
        }
    }

    suspend fun enqueue(songs: List<SongInfo>, choice: DownloadQualityChoice): DownloadEnqueueSummary =
        scope.async {
            enqueueLock.withLock {
                val enqueued = linkedSetOf<String>()
                val skipped = linkedSetOf<String>()
                val completedSkipped = linkedSetOf<String>()
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
                        // 仅把真实存在文件的已完成任务归为“已下载”。
                        if (repository.tasks.value.any { existing ->
                                existing.source == song.type && existing.songId == song.id &&
                                    existing.qualityKey == choice.toPlaybackQualityKey() &&
                                    existing.status == DownloadTaskStatus.COMPLETED &&
                                    existing.targetPath?.let(::File)?.isFile == true
                            }) completedSkipped += key
                    } else {
                        val request = Request(task.id, song.copy(embeddedCoverArt = null, lyric = null), choice)
                        requests[task.id] = request
                        queue.send(request)
                        enqueued += key
                    }
                    yield()
                }
                DownloadEnqueueSummary(enqueued, skipped, failed, completedSkipped)
            }
        }.await()

    fun pause(taskId: String): Boolean {
        if (!repository.requestPause(taskId)) return false
        if (repository.find(taskId)?.status == DownloadTaskStatus.PAUSING) {
            if (kernelTokens.containsKey(taskId)) DownloadManager.getInstance(context).pause(kernelTokens.getValue(taskId))
            else executions[taskId]?.cancel()
        }
        return true
    }

    fun pauseAll(): Int = repository.tasks.value.filter { it.status.canPause }.map { it.id }.count(::pause)

    suspend fun resume(taskId: String): Boolean = enqueueLock.withLock {
        val task = repository.find(taskId) ?: return@withLock false
        if (!task.status.canResume) return@withLock false
        resumeTask(task)
    }

    suspend fun resumeAll(): Int {
        val ids = repository.tasks.value.filter { it.status.canResume }.sortedWith(compareBy<DownloadTask> { it.createdAt }.thenBy { it.id }).map { it.id }
        var count = 0
        ids.forEach { if (resume(it)) count++ }
        return count
    }

    private suspend fun resumeTask(task: DownloadTask): Boolean {
        val choice = playbackQualityChoiceFromKey(task.qualityKey) ?: return false
        val session = AccountSessionStore.read(context)
        val access = MusicQualityAccessState(session.loggedIn, session.vipActive)
        if (!MusicQualityAccessPolicy.isChoiceAllowed(task.source, choice, access)) {
            repository.setPauseReason(task.id, DownloadFailureKind.ACCESS.description)
            return false
        }
        val target = task.targetPath?.let(::File)
        if (target != null && (!target.isAbsolute || target.canonicalPath != target.absolutePath || target.parentFile?.let { !it.isDirectory || !it.canWrite() } != false)) {
            repository.setPauseReason(task.id, "原下载目录不可用")
            return false
        }
        val queued = repository.requeue(task.id) ?: return false
        val song = SongInfo(task.songId, task.source, task.title, task.artist, task.coverUrl, album = task.album)
        val request = Request(task.id, song, choice, queued.attemptGeneration, exactQuality = true)
        requests[task.id] = request
        queue.send(request)
        return true
    }

    suspend fun retry(task: DownloadTask): DownloadEnqueueSummary = enqueueLock.withLock {
        val current = repository.find(task.id)
        val key = "${task.source}:${task.songId}"
        if (current?.status == DownloadTaskStatus.FAILED && current.targetPath?.let { AudioMetadataVerifier.isReadable(File(it)) } == true) {
            repairer.get().repairSelected(setOf(current.id))
            val restored = repository.find(current.id)?.status == DownloadTaskStatus.COMPLETED
            return@withLock DownloadEnqueueSummary(if (restored) setOf(key) else emptySet(), emptySet(), if (restored) emptySet() else setOf(key))
        }
        val success = current != null && current.status.isTerminal && DownloadResumePolicy.canRequeue(current.status.name, current.status == DownloadTaskStatus.COMPLETED && current.targetPath?.let { !File(it).exists() } == true) && resumeTask(current)
        DownloadEnqueueSummary(if (success) setOf(key) else emptySet(), emptySet(), if (success) emptySet() else setOf(key))
    }

    private suspend fun execute(request: Request) {
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
            val resource = if (request.exactQuality) urlResolver.resolveExact(request.song, request.choice, MusicQualityAccessState(session.loggedIn, session.vipActive))
                else urlResolver.resolve(request.song, request.choice, MusicQualityAccessState(session.loggedIn, session.vipActive))
            // 取链可能晚于用户暂停/取消或新一代重试完成；旧执行不得修改新任务。
            currentCoroutineContext().ensureActive()
            if (!repository.matches(request.taskId, request.generation) ||
                repository.find(request.taskId)?.status != DownloadTaskStatus.PREPARING) return
            repository.withAttempt(request.taskId, request.generation) {
                repository.updateQuality(request.taskId, resource.choice.toPlaybackQualityKey())
            }
            val identity = "${request.song.type}:${request.song.id}:${resource.choice.toPlaybackQualityKey()}"
            // 两个不同请求档位回退为同一真实档位时，共享文件也必须串行核查。
            identityLocks.getOrPut(identity) { Mutex() }.withLock {
                currentCoroutineContext().ensureActive()
                if (!repository.matches(request.taskId, request.generation) ||
                    repository.find(request.taskId)?.status != DownloadTaskStatus.PREPARING) return@withLock
                if (repository.discardResolvedDuplicate(request.taskId, request.generation)) return@withLock
                val existing = repository.tasks.value.firstOrNull {
                    it.id != request.taskId && it.source == request.song.type && it.songId == request.song.id &&
                        it.qualityKey == resource.choice.toPlaybackQualityKey() && it.status == DownloadTaskStatus.COMPLETED &&
                        it.targetPath?.let(::File)?.isFile == true
                }
                if (existing != null) {
                    repository.withAttempt(request.taskId, request.generation) {
                        if (repository.find(request.taskId)?.status == DownloadTaskStatus.PREPARING) {
                            repository.updateTarget(request.taskId, existing.fileName.orEmpty(), existing.targetPath!!)
                            repository.markCompleted(request.taskId, existing.targetPath, existing.sidecarPaths)
                        }
                    }
                    return@withLock
                }
                val target = repository.find(request.taskId)?.targetPath?.let(::File) ?: reserveTarget(request, resource.extension)
                repository.withAttempt(request.taskId, request.generation) {
                    if (repository.find(request.taskId)?.status == DownloadTaskStatus.PREPARING) {
                        repository.updateTarget(request.taskId, target.name, target.absolutePath)
                    }
                }
                download(request, resource, target, lyrics)
            }
        } catch (error: CancellationException) {
            if (repository.find(request.taskId)?.status == DownloadTaskStatus.PAUSING) repository.markPaused(request.taskId, request.generation)
            else repository.withAttempt(request.taskId, request.generation) { repository.markCancelled(request.taskId) }
        } catch (error: Exception) {
            val kind = (error as? DownloadResolutionException)?.kind ?: DownloadFailureKind.STORAGE
            repository.withAttempt(request.taskId, request.generation) {
                if (request.exactQuality) { repository.requestPause(request.taskId); repository.markPaused(request.taskId, request.generation, kind.description) }
                else repository.settleStoppedFailure(request.taskId, request.generation, kind.description)
            }
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
        // 锁内写入路径保留；旧执行代次不可覆盖恢复/重试后新代次的路径。
        repository.withAttempt(request.taskId, request.generation) {
            if (repository.find(request.taskId)?.status == DownloadTaskStatus.PREPARING) {
                repository.updateTarget(request.taskId, target.name, target.absolutePath)
            }
        }
        target
    }

    private suspend fun download(request: Request, resource: ResolvedDownloadUrl, target: File, lyrics: ResolvedDownloadLyrics) {
        val id = request.taskId
        currentCoroutineContext().ensureActive()
        val session = AccountSessionStore.read(context)
        if (!MusicQualityAccessPolicy.isChoiceAllowed(request.song.type, resource.choice, MusicQualityAccessState(session.loggedIn, session.vipActive))) {
            throw DownloadResolutionException(DownloadFailureKind.ACCESS)
        }
        var kernelToken = "$id:${request.generation}:0"
        kernelTokens[id] = kernelToken
        try {
            // 取消后仍等待内核最终回调，不能提前释放并发槽位或删除正在处理的文件。
            withContext(NonCancellable) {
                if (!repository.matches(id, request.generation) || repository.find(id)?.status !in setOf(DownloadTaskStatus.PREPARING, DownloadTaskStatus.DOWNLOADING)) {
                    if (repository.find(id)?.status == DownloadTaskStatus.PAUSING) repository.markPaused(id, request.generation)
                    return@withContext
                }
                var currentResource = resource
                for (urlAttempt in 0..1) {
                kernelToken = "$id:${request.generation}:$urlAttempt"
                kernelTokens[id] = kernelToken
                var refreshUrl = false
                val finished = CompletableDeferred<Unit>()
                repository.markDownloading(id)
                val task = repository.find(id)!!
                val identity = "${task.source}:${task.songId}:${task.qualityKey}"
                val resumeInfo = if (task.resumeQualityKey == task.qualityKey && task.resumeResourceIdentity == identity) cn.partialy.pm.utils.JavaUtils.JDownloadManager.ResumeInfo(task.resumeEtag, task.resumeLastModified, task.resumeTotalBytes ?: -1, task.downloadedBytes, task.resumeFileModified ?: -1) else null
                DownloadManager.getInstance(context).startDownload(
                    taskId = kernelToken, url = currentResource.url, fileName = target.name, songInfo = request.song,
                    resolvedLyrics = lyrics, targetDirectory = target.parentFile!!.absolutePath,
                    resumeInfo = resumeInfo,
                    callback = object : DownloadManager.DownloadCallback {
                        override fun beginProcessing(file: File): Boolean {
                            repository.withAttempt(id, request.generation) {
                                if (repository.find(id)?.status == DownloadTaskStatus.DOWNLOADING) repository.markProcessing(id, file.absolutePath)
                            }
                            return repository.matches(id, request.generation) && repository.find(id)?.status == DownloadTaskStatus.PROCESSING
                        }
                        override fun onCheckpoint(etag: String?, modified: String?, total: Long, fileModified: Long) {
                            repository.saveResume(id, request.generation, etag, modified, total, identity, fileModified)
                        }
                        override fun onPaused(downloadedBytes: Long) {
                            repository.markPaused(id, request.generation)
                            finished.complete(Unit)
                        }
                        override fun onProgress(progress: Int, downloadedSize: Long, totalSize: Long) {
                            repository.withAttempt(id, request.generation) { repository.updateProgress(id, progress, downloadedSize, totalSize) }
                        }
                        override fun onProcessing(file: File) = Unit
                        override fun onProducedFiles(file: File, sidecarPaths: List<String>) = repository.withAttempt(id, request.generation) { repository.recordProducedFiles(id, file.absolutePath, sidecarPaths) }
                        override fun onSuccess(file: File, lyricResult: LyricSidecarWriteResult, metadataResult: MetadataWriteResult) {
                            lyrics.originalWordAsset?.let { asset ->
                                runCatching {
                                    val song = request.song.copy(id = file.absolutePath, type = SongType.LOCAL)
                                    cn.partialy.pm.utils.LocalMediaIndexDbStore(context)
                                        .upsertWordLyric(song, asset.text, "download_${asset.extension}")
                                }.onFailure { Log.w("DownloadQueue", "word lyric index failed", it) }
                            }
                            repository.withAttempt(id, request.generation) {
                                repository.markCompleted(id, file.absolutePath, lyricResult.savedPaths)
                                repository.updateMetadata(id, metadataResult)
                            }
                            finished.complete(Unit)
                        }
                        override fun onCancelled() { repository.withAttempt(id, request.generation) { repository.markCancelled(id) }; finished.complete(Unit) }
                        override fun onFailure(e: Exception) {
                            refreshUrl = urlAttempt == 0 && listOf("HTTP 401", "HTTP 403", "HTTP 404").any { e.message?.contains(it) == true }
                            if (!refreshUrl) repository.settleStoppedFailure(id, request.generation, DownloadFailureKind.STORAGE.description)
                            finished.complete(Unit)
                        }
                    },
                )
                finished.await()
                if (!refreshUrl) break
                if (repository.find(id)?.status != DownloadTaskStatus.DOWNLOADING) {
                    if (repository.find(id)?.status == DownloadTaskStatus.PAUSING) repository.markPaused(id, request.generation)
                    break
                }
                val latestSession = AccountSessionStore.read(context)
                currentResource = urlResolver.resolveExact(request.song, currentResource.choice, MusicQualityAccessState(latestSession.loggedIn, latestSession.vipActive))
                }
            }
        } finally {
            kernelTokens.remove(id, kernelToken)
        }
    }
}
