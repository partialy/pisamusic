package cn.partialy.pm.activity.base

import android.annotation.SuppressLint
import android.text.format.Formatter
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.FeedbackActivity
import cn.partialy.pm.activity.LoginActivity
import cn.partialy.pm.model.DownloadQualityChoice
import cn.partialy.pm.model.MusicQualityAccessPolicy
import cn.partialy.pm.model.MusicQualityAccessState
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.kw.KwRepository
import cn.partialy.pm.network.cloudmusic.CloudMusicRepository
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.network.wy.WyRepository
import cn.partialy.pm.ui.dialog.ModernDialog
import cn.partialy.pm.ui.dialog.showDownloadQualityConfirmDialog
import cn.partialy.pm.utils.DownloadManager
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.io.File
import javax.inject.Inject

@AndroidEntryPoint
abstract class BaseDownloadActivity : BaseActivity() {
    private var downloadDialog: ModernDialog? = null

    @Inject
    lateinit var kgRepository: KgRepository

    @Inject
    lateinit var wyRepository: WyRepository

    @Inject
    lateinit var kwRepository: KwRepository

    @Inject
    lateinit var cloudMusicRepository: CloudMusicRepository

    /** 供菜单等外部入口触发与列表「下载」相同的流程。 */
    fun startSongDownloadFlow(songInfo: SongInfo) {
        onDownloadClick(songInfo)
    }

    protected fun onDownloadClick(songInfo: SongInfo) {
        lifecycleScope.launch {
            if (songInfo.type == SongType.LOCAL) {
                Toast.makeText(this@BaseDownloadActivity, R.string.local_song_no_online_download, Toast.LENGTH_SHORT).show()
                return@launch
            }
            if (!songInfo.playable) {
                Toast.makeText(this@BaseDownloadActivity, R.string.cloud_music_disabled_download, Toast.LENGTH_SHORT).show()
                return@launch
            }
            val session = AccountSessionStore.read(this@BaseDownloadActivity)
            val options = MusicQualityAccessPolicy.optionsFor(
                songInfo.type,
                MusicQualityAccessState(session.loggedIn, session.vipActive),
            )
            if (options.isEmpty()) {
                Toast.makeText(this@BaseDownloadActivity, R.string.toast_playback_quality_no_options, Toast.LENGTH_SHORT).show()
                return@launch
            }
            val subtitle = getString(R.string.common_song_subtitle, songInfo.artist, songInfo.name)
            val selected = showDownloadQualityConfirmDialog(
                this@BaseDownloadActivity,
                subtitle,
                options,
                song = songInfo,
                onRestrictedOptionClick = {
                    if (session.loggedIn) {
                        FeedbackActivity.startForQualityUnlock(this@BaseDownloadActivity)
                    } else {
                        LoginActivity.start(this@BaseDownloadActivity)
                    }
                },
            ) ?: return@launch

            val latestSession = AccountSessionStore.read(this@BaseDownloadActivity)
            val stillAllowed = MusicQualityAccessPolicy.isChoiceAllowed(
                songInfo.type,
                selected.choice,
                MusicQualityAccessState(latestSession.loggedIn, latestSession.vipActive),
            )
            if (!stillAllowed) {
                Toast.makeText(this@BaseDownloadActivity, R.string.download_quality_unavailable_reselect, Toast.LENGTH_SHORT).show()
                return@launch
            }

            if (songInfo.type != SongType.KW && SettingsPrefs.isWriteLyricsEnabled(this@BaseDownloadActivity)) {
                val lyricText = try {
                    when (songInfo.type) {
                        SongType.KG -> kgRepository.getLyric(songInfo.id).getOrNull().orEmpty()
                        SongType.WY -> wyRepository.getLyric(songInfo.id.toLongOrNull() ?: -1L).getOrNull().orEmpty()
                        SongType.CLOUD -> {
                            val resource = cloudMusicRepository.getLyricsResource(songInfo.id)
                            cloudMusicRepository.fetchLyricsText(resource)
                        }
                        SongType.KW, SongType.LOCAL -> ""
                    }
                } catch (_: Exception) {
                    ""
                }
                if (lyricText.isNotBlank()) songInfo.lyric = lyricText
            }

            // Cloud 的播放地址必须最后临近下载签发；资源响应自带格式时不再额外请求详情。
            val downloadInfo = try {
                when (val c = selected.choice) {
                    is DownloadQualityChoice.Kugou -> kgRepository.getDownloadUrl(songInfo, c.quality)
                    is DownloadQualityChoice.NeteaseBr -> wyRepository.getDownloadUrlWithBr(songInfo, c.br)
                    is DownloadQualityChoice.NeteaseLevel -> wyRepository.getDownloadUrlWithLevel(songInfo, c.level)
                    is DownloadQualityChoice.Kuwo -> kwRepository.getDownloadUrl(songInfo, c.quality)
                    DownloadQualityChoice.CloudDefault -> {
                        val resource = cloudMusicRepository.getPlayResource(songInfo.id)
                        val url = resource.url.toHttpDownloadUrlOrNull()
                            ?: throw IllegalArgumentException("invalid cloud download url")
                        val format = resource.format.toSafeAudioExtension()
                            ?: songInfo.name.substringAfterLast('.', "").toKnownAudioExtension()
                            ?: DEFAULT_CLOUD_AUDIO_EXTENSION
                        mapOf(
                            "url" to url,
                            "songName" to "cloud.$format",
                        )
                    }
                }
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                mapOf("url" to "error")
            }
            if (downloadInfo["url"] == "error" || downloadInfo["url"] == "buy") {
                Toast.makeText(this@BaseDownloadActivity, R.string.download_link_failed, Toast.LENGTH_SHORT).show()
                return@launch
            }
            val url = downloadInfo["url"]?.toHttpDownloadUrlOrNull() ?: run {
                Toast.makeText(this@BaseDownloadActivity, R.string.download_link_failed, Toast.LENGTH_SHORT).show()
                return@launch
            }
            val ext = (downloadInfo["songName"] ?: "").substringAfterLast('.', "")
            val naming = SettingsPrefs.getFileNamingRule(this@BaseDownloadActivity)
            val base = when (naming) {
                SettingsPrefs.FileNamingRule.TitleDashArtist -> "${songInfo.name} - ${songInfo.artist}"
                SettingsPrefs.FileNamingRule.ArtistDashTitle -> "${songInfo.artist} - ${songInfo.name}"
            }
            val name = if (ext.isNotBlank()) "$base.$ext" else base

            startDownload(url, name, songInfo)
        }
    }

    /**
     * 开始下载并显示进度
     */
    @SuppressLint("SetTextI18n")
    protected fun startDownload(url: String, fileName: String, songInfo: SongInfo) {
        try {
            downloadDialog = ModernDialog.makeDownloadDialog(this) {
                title = getString(R.string.download_in_progress)
                message = fileName
                cancelable = true
                positiveText = getString(R.string.download_background)
                negativeText = getString(R.string.cancel)

                onPositiveClick = {
                    downloadDialog?.dismiss()
                }

                onNegativeClick = {
                    downloadDialog?.dismiss()
                }
            }

            downloadDialog?.show()
            Toast.makeText(this, R.string.toast_download_started, Toast.LENGTH_SHORT).show()

            DownloadManager.getInstance(this).startDownload(
                url = url,
                fileName = fileName,
                songInfo = songInfo,
                callback = object : DownloadManager.DownloadCallback {
                    override fun onProgress(progress: Int, downloadedSize: Long, totalSize: Long) {
                        runOnUiThread {
                            downloadDialog?.let { dialog ->
                                val progressText = "${Formatter.formatFileSize(this@BaseDownloadActivity, downloadedSize)} / " +
                                    Formatter.formatFileSize(this@BaseDownloadActivity, totalSize)

                                dialog.updateMessage(
                                    """
                                    $fileName
                                    $progressText
                                    """.trimIndent(),
                                )
                                dialog.updateProgress(progress)
                            }
                        }
                    }

                    override fun onSuccess(file: File) {
                        onDownloadSuccess(file)
                    }

                    override fun onFailure(e: Exception) {
                        onDownloadFailure(e)
                    }
                },
            )
        } catch (e: Exception) {
            println("下载出错：$e")
            onDownloadFailure(e)
        }
    }

    protected open fun onDownloadSuccess(file: File) {
        runOnUiThread {
            Toast.makeText(this, R.string.download_complete, Toast.LENGTH_SHORT).show()
            downloadDialog?.dismiss()
        }
    }

    protected open fun onDownloadFailure(e: Exception) {
        runOnUiThread {
            println(e)
            Toast.makeText(this, getString(R.string.download_failed_with_reason, e.message.orEmpty()), Toast.LENGTH_SHORT).show()
            downloadDialog?.dismiss()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        downloadDialog?.dismiss()
    }

    private fun String.toHttpDownloadUrlOrNull(): String? {
        val parsed = toHttpUrlOrNull() ?: return null
        return takeIf { parsed.scheme == "https" || parsed.scheme == "http" }
    }

    private fun String?.toSafeAudioExtension(): String? = this
        ?.trim()
        ?.lowercase()
        ?.removePrefix(".")
        ?.takeIf { it.matches(Regex("[a-z0-9]{1,8}")) }

    private fun String?.toKnownAudioExtension(): String? = toSafeAudioExtension()
        ?.takeIf(KNOWN_AUDIO_EXTENSIONS::contains)

    private companion object {
        const val DEFAULT_CLOUD_AUDIO_EXTENSION = "mp3"
        val KNOWN_AUDIO_EXTENSIONS = setOf("mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "ape", "wma")
    }
}
