package cn.partialy.pm.player

import android.content.Context
import androidx.core.net.toUri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import cn.partialy.pm.model.DownloadQualityChoice
import cn.partialy.pm.model.MusicQualityAccessPolicy
import cn.partialy.pm.model.MusicQualityAccessState
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.matchesSongType
import cn.partialy.pm.model.playbackQualityChoiceFromKey
import cn.partialy.pm.model.toPlaybackQualityKey
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.player.cache.PlaybackMediaCache
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.utils.SongCoverUrl

/**
 * MediaItem 工厂：负责创建占位 / 本地 MediaItem，并把在线逻辑媒体项委托给缓存门面。
 * 纯工厂，不持有 ExoPlayer 引用。
 */
class MediaItemFactory(
    private val context: Context,
    private val playbackMediaCache: PlaybackMediaCache,
    private val playUrlGetter: PlayUrlGetter,
) {

    companion object {
        const val PLACEHOLDER_URI_PREFIX = "pm://placeholder/"
    }

    /** 生成 type_id 唯一键 */
    fun keyOf(song: SongInfo): String = "${song.type}_${song.id}"

    /** 生成稳定缓存键，避免 URL 或播放音质变化导致缓存失配。 */
    fun cacheKeyOf(song: SongInfo): String =
        playbackMediaCache.cacheKeyOf(song, playbackQualityKeyOf(song))

    fun playbackQualityKeyOf(song: SongInfo): String {
        if (song.type == SongType.LOCAL) return "local"
        if (song.type == SongType.CLOUD) return "cloud:default"
        val choice = savedPlaybackQualityChoice(song)
        return choice?.toPlaybackQualityKey() ?: "auto"
    }

    private fun savedPlaybackQualityChoice(song: SongInfo): DownloadQualityChoice? {
        val savedKey = SettingsPrefs.getPlaybackQualityKey(context, song.type)
        val savedChoice = playbackQualityChoiceFromKey(savedKey)
        val session = AccountSessionStore.read(context)
        val allowedChoice = MusicQualityAccessPolicy.allowedChoiceOrFallback(
            song.type,
            savedChoice,
            MusicQualityAccessState(session.loggedIn, session.vipActive),
        )
        val allowedKey = allowedChoice?.toPlaybackQualityKey()
        if (savedKey != null && allowedKey != null && savedKey != allowedKey) {
            SettingsPrefs.setPlaybackQualityKey(context, song.type, allowedKey)
        }
        return allowedChoice
    }

    /**
     * 构造可立即播放的媒体项。Cloud 每次调用都会重新向 server 签发临时地址，
     * 因此只能在真正准备播放或切换音质时使用。
     */
    suspend fun createMediaItem(song: SongInfo): MediaItem {
        require(song.playable) { "song is disabled" }
        val choice = savedPlaybackQualityChoice(song)
        val qualityKey = choice?.toPlaybackQualityKey() ?: "auto"
        return when (song.type) {
            SongType.LOCAL -> buildMediaItem(song, song.id)
            SongType.CLOUD -> buildCloudMediaItem(song, choice ?: DownloadQualityChoice.CloudDefault)
            SongType.KG, SongType.WY, SongType.KW -> playbackMediaCache.mediaItem(song, qualityKey)
        }
    }

    /**
     * 构造稳定队列项。Cloud 只登记不含临时地址的占位项，切到该曲目前再由
     * PlayerEngine 通过 [createMediaItem] 刷新，避免整批队列长期持有过期签名。
     */
    suspend fun createQueueMediaItem(song: SongInfo): MediaItem {
        require(song.playable) { "song is disabled" }
        return if (song.type == SongType.CLOUD) {
            createPlaceholderMediaItem(song)
        } else {
            createMediaItem(song)
        }
    }

    suspend fun createMediaItemWithQuality(
        song: SongInfo,
        choice: DownloadQualityChoice,
    ): MediaItem {
        require(song.playable) { "song is disabled" }
        if (!choice.matchesSongType(song.type)) {
            throw IllegalArgumentException("quality does not match song type")
        }
        if (song.type == SongType.CLOUD) {
            return buildCloudMediaItem(song, choice)
        }
        val qualityKey = choice.toPlaybackQualityKey()
        return playbackMediaCache.mediaItem(song, qualityKey)
    }

    private suspend fun buildCloudMediaItem(
        song: SongInfo,
        choice: DownloadQualityChoice,
    ): MediaItem {
        val resolved = playUrlGetter.getUrl(song, choice, allowFallback = false)
        require(resolved.url.startsWith("http://") || resolved.url.startsWith("https://")) {
            "cloud play url resolution failed"
        }
        return buildMediaItem(song, resolved.url, mediaId = keyOf(song))
    }

    /** 创建占位 MediaItem（不请求 URL，切歌时再按需获取） */
    fun createPlaceholderMediaItem(song: SongInfo): MediaItem {
        val key = keyOf(song)
        return buildMediaItem(song, "$PLACEHOLDER_URI_PREFIX$key", mediaId = key)
    }

    /** 判断是否为尚未解析 URL 的占位项 */
    fun isPlaceholderMediaItem(mediaItem: MediaItem?): Boolean {
        val uri = mediaItem?.localConfiguration?.uri?.toString().orEmpty()
        return uri.startsWith(PLACEHOLDER_URI_PREFIX)
    }

    private fun buildMediaItem(
        song: SongInfo,
        uri: String,
        mediaId: String? = null,
    ): MediaItem {
        val coverUri = SongCoverUrl.getSongCover(song, SongCoverUrl.SIZE_XLARGE)
            .takeIf { it.isNotBlank() }
            ?.toUri()
        val meta = MediaMetadata.Builder()
            .setTitle(song.name)
            .setArtist(song.artist)
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
        if (coverUri != null) meta.setArtworkUri(coverUri)

        val builder = MediaItem.Builder()
            .setUri(uri)
            .setMediaMetadata(meta.build())
        if (mediaId != null) builder.setMediaId(mediaId)
        return builder.build()
    }
}
