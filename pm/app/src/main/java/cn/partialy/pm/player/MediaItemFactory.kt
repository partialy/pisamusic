package cn.partialy.pm.player

import androidx.core.net.toUri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import java.util.concurrent.ConcurrentHashMap

/**
 * MediaItem 工厂：负责创建占位 / 真实 MediaItem，管理播放 URL 缓存。
 * 纯工厂，不持有 ExoPlayer 引用。
 */
class MediaItemFactory(private val playUrlGetter: PlayUrlGetter) {

    companion object {
        const val PLACEHOLDER_URI_PREFIX = "pm://placeholder/"
        private const val PLAY_URL_CACHE_TTL_MS = 10 * 60 * 1000L
    }

    private data class CachedPlayableUrl(
        val url: String,
        val savedAtMs: Long,
    )

    private val playUrlCache = ConcurrentHashMap<String, CachedPlayableUrl>()

    /** 生成 type_id 唯一键 */
    fun keyOf(song: SongInfo): String = "${song.type}_${song.id}"

    /** 生成稳定缓存键，避免 URL 变化导致缓存失配。 */
    fun cacheKeyOf(song: SongInfo): String = "${song.type}_${song.id}_${defaultQualityOf(song)}"

    private fun defaultQualityOf(song: SongInfo): String = when (song.type) {
        SongType.KG -> "128"
        SongType.WY -> "standard"
        SongType.KW -> "exhigh"
        SongType.LOCAL -> "local"
    }

    /** 创建真实可播放的 MediaItem（会挂起获取 URL） */
    suspend fun createMediaItem(song: SongInfo, forceRefreshUrl: Boolean = false): MediaItem {
        val url = getOrFetchPlayableUrl(song, forceRefreshUrl)
        return buildMediaItem(song, url)
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

    /** 获取播放 URL，优先从缓存读取 */
    suspend fun getOrFetchPlayableUrl(song: SongInfo, forceRefreshUrl: Boolean = false): String {
        if (song.type == SongType.LOCAL) return song.id
        val key = keyOf(song)
        if (!forceRefreshUrl) {
            playUrlCache[key]?.takeIf { it.isFresh() }?.let { return it.url }
        } else {
            playUrlCache.remove(key)
        }

        val url = when (song.type) {
            SongType.KG -> playUrlGetter.getKgUrl(song)
            SongType.WY -> playUrlGetter.getWyUrl(song)
            SongType.KW -> playUrlGetter.getKwUrl(song)
            SongType.LOCAL -> song.id
        }
        if (isCacheablePlayableUrl(url)) {
            playUrlCache[key] = CachedPlayableUrl(url, System.currentTimeMillis())
        }
        return url
    }

    /** 读取已缓存的 URL（仅内存缓存，不触发网络）。 */
    fun getCachedPlayableUrl(song: SongInfo): String? =
        playUrlCache[keyOf(song)]?.takeIf { it.isFresh() }?.url

    /** 写入短期 URL 缓存，仅用于当前进程内复用。 */
    fun putCachedPlayableUrl(song: SongInfo, url: String) {
        if (song.type == SongType.LOCAL || !isCacheablePlayableUrl(url)) return
        playUrlCache[keyOf(song)] = CachedPlayableUrl(url, System.currentTimeMillis())
    }

    fun invalidateCachedPlayableUrl(song: SongInfo) {
        playUrlCache.remove(keyOf(song))
    }

    private fun CachedPlayableUrl.isFresh(): Boolean =
        isCacheablePlayableUrl(url) && System.currentTimeMillis() - savedAtMs < PLAY_URL_CACHE_TTL_MS

    private fun isCacheablePlayableUrl(url: String): Boolean =
        url.isNotBlank() && url != "error" && url.startsWith("http")

    private fun buildMediaItem(
        song: SongInfo,
        uri: String,
        mediaId: String? = null,
    ): MediaItem {
        val coverUri = song.coverUrl.takeIf { it.isNotBlank() }?.toUri()
        val meta = MediaMetadata.Builder()
            .setTitle(song.name)
            .setArtist(song.artist)
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
        if (coverUri != null) meta.setArtworkUri(coverUri)

        val builder = MediaItem.Builder()
            .setUri(uri)
            .setMediaMetadata(meta.build())
        if (song.type != SongType.LOCAL && !uri.startsWith(PLACEHOLDER_URI_PREFIX)) {
            builder.setCustomCacheKey(cacheKeyOf(song))
        }
        if (mediaId != null) builder.setMediaId(mediaId)
        return builder.build()
    }
}
