package cn.partialy.pm.player.cache

/** 根据从字节 0 开始的连续覆盖长度判断资源是否完整。 */
object CacheCoverage {

    fun evaluate(totalBytes: Long, contiguousBytes: Long): PlaybackCacheStatus =
        if (totalBytes > 0L && contiguousBytes == totalBytes) {
            PlaybackCacheStatus.READY
        } else {
            PlaybackCacheStatus.PARTIAL
        }
}
