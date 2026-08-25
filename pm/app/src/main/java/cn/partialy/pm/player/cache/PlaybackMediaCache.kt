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

    fun release()
}
