package cn.partialy.pm.activity.base

import cn.partialy.pm.ui.message.PmMessage
import androidx.lifecycle.lifecycleScope
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
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CancellationException
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
                if (summary.failedKeys.isNotEmpty()) PmMessage.warning(this@BaseDownloadActivity, message)
                else PmMessage.success(this@BaseDownloadActivity, message)
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
