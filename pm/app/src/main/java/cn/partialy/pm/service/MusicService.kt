package cn.partialy.pm.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.graphics.Bitmap
import android.graphics.drawable.Drawable
import android.os.Build
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.ui.PlayerNotificationManager
import androidx.media3.ui.PlayerNotificationManager.MediaDescriptionAdapter
import cn.partialy.pm.R
import cn.partialy.pm.activity.PlayerActivity
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.statusbarlyric.StatusBarLyricOverlayController
import cn.partialy.pm.utils.SongCoverUrl
import com.bumptech.glide.Glide
import com.bumptech.glide.request.target.CustomTarget
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
@UnstableApi
class MusicService : MediaSessionService() {

    @Inject
    lateinit var musicController: MusicController

    @Inject
    lateinit var statusBarLyricOverlayController: StatusBarLyricOverlayController

    private val NOTIFICATION_ID = 13
    private val CHANNEL_ID = "music_channel"
    private lateinit var playerNotificationManager: PlayerNotificationManager

    override fun onCreate() {
        super.onCreate()
        // 创建通知渠道
        createNotificationChannel()

        // 初始化 PlayerNotificationManager
        playerNotificationManager = PlayerNotificationManager.Builder(
            this,
            NOTIFICATION_ID,
            CHANNEL_ID
        )
            .setMediaDescriptionAdapter(object : MediaDescriptionAdapter {
                override fun getCurrentContentTitle(player: Player): CharSequence {
                    return musicController.currentSong.value?.name ?: "Unknown"
                }

                override fun createCurrentContentIntent(player: Player): PendingIntent? {
                    val intent = PlayerActivity.createLaunchIntent(this@MusicService)
                    return PendingIntent.getActivity(
                        this@MusicService,
                        0,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                }

                override fun getCurrentContentText(player: Player): CharSequence? {
                    return musicController.currentSong.value?.artist
                }

                override fun getCurrentLargeIcon(
                    player: Player,
                    callback: PlayerNotificationManager.BitmapCallback
                ): Bitmap? {
                    val coverUrl = musicController.currentSong.value
                        ?.let { SongCoverUrl.getSongCover(it, SongCoverUrl.SIZE_SMALL) }
                    if (coverUrl.isNullOrEmpty()) return null

                    Glide.with(this@MusicService)
                        .asBitmap()
                        .load(coverUrl)
                        .into(object : CustomTarget<Bitmap>(144, 144) {
                            override fun onResourceReady(
                                resource: Bitmap,
                                transition: com.bumptech.glide.request.transition.Transition<in Bitmap>?
                            ) {
                                callback.onBitmap(resource)
                            }

                            override fun onLoadCleared(placeholder: Drawable?) {
                                // 不需要处理
                            }
                        })

                    return null
                }
            })
            .setSmallIconResourceId(R.drawable.ic_pm_icon)
            .setNotificationListener(object : PlayerNotificationManager.NotificationListener {
                override fun onNotificationPosted(
                    notificationId: Int,
                    notification: Notification,
                    ongoing: Boolean
                ) {
                    // 确保服务在前台运行
                    startForeground(notificationId, notification)
                }
            })
            .build()

        playerNotificationManager.setPlayer(musicController.exoPlayer)
        musicController.mediaSession?.sessionCompatToken?.let {
            playerNotificationManager.setMediaSessionToken(it)
        }

        // 确保服务在前台运行
        startForegroundService()
        statusBarLyricOverlayController.start()
    }

    // 创建通知渠道的方法
    private fun createNotificationChannel() {
        val name = R.string.app_name.toString()
        val descriptionText = "${name}播放通知"
        val importance = NotificationManager.IMPORTANCE_LOW
        val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
            description = descriptionText
        }
        val notificationManager: NotificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.createNotificationChannel(channel)
    }

    // 启动前台服务的方法
    private fun startForegroundService() {
        // 直接设置播放器即可，PlayerNotificationManager 会自动处理前台服务
        playerNotificationManager.setPlayer(musicController.exoPlayer)
    }

    override fun onDestroy() {
        statusBarLyricOverlayController.stop()
        playerNotificationManager.setPlayer(null)
        musicController.release()
        super.onDestroy()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return musicController.mediaSession
    }
}
