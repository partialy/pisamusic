package cn.partialy.pm.player.cache

import java.net.URI

/** 一首在线歌曲在指定音质下的稳定缓存身份。 */
data class PlaybackCacheIdentity(
    val source: String,
    val songId: String,
    val qualityKey: String,
    val cacheKey: String,
    val logicalUri: URI,
)

/** 未知长度或存在缺口的缓存均为 [PARTIAL]。 */
enum class PlaybackCacheStatus {
    PARTIAL,
    READY,
}

/** 单个缓存资源的实时完整性快照。 */
data class PlaybackCacheEntry(
    val identity: PlaybackCacheIdentity,
    val totalBytes: Long,
    val cachedBytes: Long,
    val status: PlaybackCacheStatus,
)

/** 播放缓存模块对外提供的聚合快照。 */
data class PlaybackCacheSnapshot(
    val usedBytes: Long,
    val entryCount: Int,
    val readyCount: Int,
    val partialCount: Int,
)
