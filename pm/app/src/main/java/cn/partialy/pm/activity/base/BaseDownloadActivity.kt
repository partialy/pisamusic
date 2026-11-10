package cn.partialy.pm.activity.base

import cn.partialy.pm.ui.message.PmMessage
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.Lifecycle
import cn.partialy.pm.R
import cn.partialy.pm.activity.FeedbackActivity
import cn.partialy.pm.activity.LoginActivity
import cn.partialy.pm.download.task.DownloadEnqueueSummary
import cn.partialy.pm.download.task.DownloadQueueCoordinator
import cn.partialy.pm.model.MusicQualityAccessPolicy
import cn.partialy.pm.model.MusicQualityAccessState
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.network.wy.WyRepository
import cn.partialy.pm.network.kw.KwRepository
import cn.partialy.pm.network.cloudmusic.CloudMusicRepository
import cn.partialy.pm.ui.dialog.showDownloadQualityConfirmDialog
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.message.MessageType
import cn.partialy.pm.ui.mine.planPlaylistBatchDownload
import cn.partialy.pm.ui.mine.playlistSongKey
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 界面仅选择音质并入队；网络、文件与回调归进程级协调器所有。 */
@AndroidEntryPoint
abstract class BaseDownloadActivity : BaseActivity() {
    @Inject lateinit var kgRepository: KgRepository
    @Inject lateinit var wyRepository: WyRepository
    @Inject lateinit var kwRepository: KwRepository
    @Inject lateinit var cloudMusicRepository: CloudMusicRepository
    @Inject lateinit var downloadQueueCoordinator: DownloadQueueCoordinator
    private var downloadFlowActive = false
    private var groupedDownloadJob: Job? = null

    override fun onStop() {
        // 页面不再可见时停止后续音质选择；已进入进程级队列的任务不受影响。
        groupedDownloadJob?.cancel()
        super.onStop()
    }

    /** 混合音源批量入队：每组单独选择音质，结束只汇总一次。 */
    fun startPlaylistBatchDownloadFlow(
        songs: List<SongInfo>,
        onHandled: (Set<String>) -> Unit = {},
        onFinished: () -> Unit = {},
    ) {
        if (downloadFlowActive) { onFinished(); return }
        downloadFlowActive = true
        groupedDownloadJob = lifecycleScope.launch {
            var enqueued = 0
            var skipped = 0
            var failed = 0
            var processed = 0
            var stoppedByUser = false
            val plan = planPlaylistBatchDownload(songs)
            try {
                if (plan.validCount == 0) {
                    if (plan.localSkipped > 0 && plan.unavailableSkipped == 0) {
                        PmMessage.warning(this@BaseDownloadActivity, R.string.local_song_no_online_download)
                    } else {
                        PmMessage.warning(this@BaseDownloadActivity, R.string.playlist_batch_nothing_downloadable)
                    }
                    return@launch
                }
                if (plan.validCount > 100 && !confirmPlaylistBatchSize(plan.validCount)) return@launch
                for (group in plan.groups) {
                    val first = group.first()
                    val session = AccountSessionStore.read(this@BaseDownloadActivity)
                    val options = MusicQualityAccessPolicy.optionsFor(
                        first.type, MusicQualityAccessState(session.loggedIn, session.vipActive),
                    )
                    if (options.isEmpty()) {
                        failed += group.size
                        processed += group.size
                        continue
                    }
                    val selected = showDownloadQualityConfirmDialog(
                        this@BaseDownloadActivity,
                        getString(R.string.download_queue_selection_count, group.size),
                        options,
                        song = first,
                        onRestrictedOptionClick = {
                            if (session.loggedIn) FeedbackActivity.startForQualityUnlock(this@BaseDownloadActivity)
                            else LoginActivity.start(this@BaseDownloadActivity)
                        },
                    )
                    if (selected == null) {
                        stoppedByUser = true
                        break
                    }
                    try {
                        val summary = downloadQueueCoordinator.enqueue(group, selected.choice)
                        enqueued += summary.enqueuedKeys.size
                        skipped += summary.skippedKeys.size
                        failed += summary.failedKeys.size
                        val handled = summary.enqueuedKeys + summary.skippedKeys
                        onHandled(group.filter { "${it.type}:${it.id}" in handled }
                            .mapTo(linkedSetOf(), ::playlistSongKey))
                    } catch (cancel: CancellationException) {
                        throw cancel
                    } catch (_: Exception) {
                        failed += group.size
                    }
                    processed += group.size
                }
                if ((processed > 0 || plan.localSkipped > 0 || plan.unavailableSkipped > 0) &&
                    lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED) && !isDestroyed && !isFinishing
                ) {
                    val summaryText = getString(R.string.playlist_batch_download_summary,
                        enqueued, skipped, failed, plan.localSkipped, plan.unavailableSkipped)
                    val remaining = (plan.validCount - processed).coerceAtLeast(0)
                    val message = if (stoppedByUser && remaining > 0) {
                        summaryText + getString(R.string.playlist_batch_download_canceled, remaining)
                    } else summaryText
                    PmMessage.show(this@BaseDownloadActivity,
                        if (failed > 0 || stoppedByUser || plan.unavailableSkipped > 0)
                            MessageType.WARNING else MessageType.SUCCESS,
                        message, 2000L, null)
                }
            } catch (cancel: CancellationException) {
                throw cancel
            } finally {
                groupedDownloadJob = null
                downloadFlowActive = false
                onFinished()
            }
        }
    }

    /** 先确认有效总数，再开始逐音源选音质；取消不会创建任何下载任务。 */
    private suspend fun confirmPlaylistBatchSize(count: Int): Boolean =
        suspendCancellableCoroutine { cont ->
            var confirmed = false
            val dialog = PmMinimalDialog.show(
                this,
                message = getString(R.string.online_batch_large_download, count),
                cancelText = getString(R.string.cancel),
                confirmText = getString(R.string.dialog_ok),
                onConfirm = {
                    confirmed = true
                    if (cont.isActive) cont.resume(true)
                },
            )
            dialog.setOnDismissListener {
                if (!confirmed && cont.isActive) cont.resume(false)
            }
            cont.invokeOnCancellation { dialog.dismiss() }
        }

    fun startSongDownloadFlow(songInfo: SongInfo) = onDownloadClick(songInfo)

    protected fun onDownloadClick(songInfo: SongInfo) = startSongsDownloadFlow(listOf(songInfo))

    /** 同源歌曲批量只选一次音质；取消也会回调 onFinished。 */
    fun startSongsDownloadFlow(
        songs: List<SongInfo>,
        onResult: (DownloadEnqueueSummary) -> Unit = {},
        onFinished: () -> Unit = {},
    ) {
        if (downloadFlowActive) { onFinished(); return }
        downloadFlowActive = true
        lifecycleScope.launch {
            try {
                val song = songs.firstOrNull() ?: return@launch
                if (song.type == SongType.LOCAL) {
                    PmMessage.warning(this@BaseDownloadActivity, R.string.local_song_no_online_download)
                    return@launch
                }
                if (songs.size == 1 && !song.playable) {
                    PmMessage.warning(this@BaseDownloadActivity, R.string.cloud_music_disabled_download)
                    return@launch
                }
                val session = AccountSessionStore.read(this@BaseDownloadActivity)
                val options = MusicQualityAccessPolicy.optionsFor(song.type, MusicQualityAccessState(session.loggedIn, session.vipActive))
                if (options.isEmpty()) return@launch
                val selected = showDownloadQualityConfirmDialog(
                    this@BaseDownloadActivity,
                    if (songs.size == 1) getString(R.string.common_song_subtitle, song.artist, song.name)
                    else getString(R.string.download_queue_selection_count, songs.size),
                    options,
                    song = song,
                    onRestrictedOptionClick = {
                        if (session.loggedIn) FeedbackActivity.startForQualityUnlock(this@BaseDownloadActivity)
                        else LoginActivity.start(this@BaseDownloadActivity)
                    },
                ) ?: return@launch
                val summary = downloadQueueCoordinator.enqueue(songs, selected.choice)
                val message = getString(R.string.download_queue_summary, summary.enqueuedKeys.size, summary.skippedKeys.size, summary.failedKeys.size)
                when {
                    summary.failedKeys.isNotEmpty() -> PmMessage.warning(
                        this@BaseDownloadActivity,
                        if (songs.size == 1) getString(R.string.download_queue_enqueue_failed) else message,
                    )
                    songs.size == 1 && summary.enqueuedKeys.isNotEmpty() ->
                        PmMessage.success(this@BaseDownloadActivity, R.string.download_queue_added_single)
                    songs.size == 1 && summary.skippedKeys.isNotEmpty() -> {
                        val key = summary.skippedKeys.first()
                        val text = if (key in summary.completedSkippedKeys) {
                            R.string.download_queue_already_completed
                        } else R.string.download_queue_already_queued
                        PmMessage.info(this@BaseDownloadActivity, text)
                    }
                    summary.enqueuedKeys.isNotEmpty() -> PmMessage.success(this@BaseDownloadActivity, message)
                    summary.skippedKeys.isNotEmpty() -> PmMessage.info(this@BaseDownloadActivity, message)
                }
                onResult(summary)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                PmMessage.error(this@BaseDownloadActivity, R.string.download_queue_enqueue_failed)
            } finally {
                downloadFlowActive = false
                onFinished()
            }
        }
    }
}
