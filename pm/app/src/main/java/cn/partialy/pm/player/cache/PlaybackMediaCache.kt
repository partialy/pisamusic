package cn.partialy.pm.player.cache

import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.source.MediaSource
import cn.partialy.pm.model.SongInfo

/**
 * 播放器、缓存管理和自动回退共同依赖的唯一缓存边界。
 *
 * 调用方不应感知物理缓存、播放地址刷新或目录索引的实现细节。
 */
@UnstableApi
interface PlaybackMediaCache {
    fun mediaItem(song: SongInfo, qualityKey: String): MediaItem

    fun placeholderMediaItem(song: SongInfo): MediaItem

    /** 返回该在线媒体项冻结的规范化实际音质；身份不一致或无法解析时返回 null。 */
    fun qualityKeyOf(song: SongInfo, mediaItem: MediaItem): String?

    fun mediaSourceFactory(): MediaSource.Factory

    fun cacheKeyOf(song: SongInfo, qualityKey: String): String

    fun register(song: SongInfo, qualityKey: String): PlaybackCacheIdentity

    fun syncEntry(song: SongInfo, qualityKey: String): PlaybackCacheEntry

    fun readySongs(
        qualityKeyOf: (SongInfo) -> String,
        limit: Int = 200,
    ): List<SongInfo>

    fun snapshot(): PlaybackCacheSnapshot

    fun clear(): PlaybackCacheSnapshot

    /** renderer 重建时释放当前缓存实例，后续操作仍可按需重开。 */
    fun release()

    /** 播放器最终退出；等待在途门面操作后关闭，之后不可重开。 */
    fun shutdown()
}
