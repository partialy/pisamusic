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

    /** 在线歌曲使用逻辑 URI；本地歌曲保留原始 content/file URI 并绕过缓存。 */
    fun createMediaItem(song: SongInfo): MediaItem {
        val choice = savedPlaybackQualityChoice(song)
        val qualityKey = choice?.toPlaybackQualityKey() ?: "auto"
        return if (song.type == SongType.LOCAL) {
            buildMediaItem(song, song.id)
        } else {
            playbackMediaCache.mediaItem(song, qualityKey)
        }
    }

    fun createMediaItemWithQuality(
        song: SongInfo,
        choice: DownloadQualityChoice,
    ): MediaItem {
        if (!choice.matchesSongType(song.type)) {
            throw IllegalArgumentException("quality does not match song type")
        }
        val qualityKey = choice.toPlaybackQualityKey()
        return playbackMediaCache.mediaItem(song, qualityKey)
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
