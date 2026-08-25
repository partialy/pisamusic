package cn.partialy.pm.player.cache

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.ContentMetadata
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

data class Media3CacheResourceSnapshot(
    val cacheKey: String,
    val totalBytes: Long,
    val cachedBytes: Long,
    val status: PlaybackCacheStatus,
)

/** Media3 Span 的唯一事实来源，并在模块生命周期内只持有一个 [SimpleCache]。 */
@Singleton
@UnstableApi
class Media3CacheStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val applicationContext = context.applicationContext
    private val cache = SimpleCache(
        File(applicationContext.cacheDir, AUDIO_CACHE_DIR).apply { mkdirs() },
        LeastRecentlyUsedCacheEvictor(SettingsPrefs.getAudioCacheMaxBytes(applicationContext)),
        StandaloneDatabaseProvider(applicationContext),
    )

    fun snapshot(cacheKey: String): Media3CacheResourceSnapshot {
        val metadataLength = ContentMetadata.getContentLength(cache.getContentMetadata(cacheKey))
        val totalBytes = metadataLength
            .takeUnless { it == C.LENGTH_UNSET.toLong() || it <= 0L }
            ?: 0L
        val contiguousBytes = if (totalBytes > 0L) {
            cache.getCachedLength(cacheKey, 0L, totalBytes)
        } else {
            0L
        }
        val status = CacheCoverage.evaluate(totalBytes, contiguousBytes)
        val cachedBytes = if (status == PlaybackCacheStatus.READY) {
            totalBytes
        } else {
            cache.getCachedBytes(cacheKey, 0L, Long.MAX_VALUE).coerceAtLeast(0L)
        }
        return Media3CacheResourceSnapshot(
            cacheKey = cacheKey,
            totalBytes = totalBytes,
            cachedBytes = cachedBytes,
            status = status,
        )
    }

    fun snapshot(): PlaybackCacheSnapshot {
        val entries = cache.keys.map(::snapshot)
        return PlaybackCacheSnapshot(
            usedBytes = cache.cacheSpace.coerceAtLeast(0L),
            entryCount = entries.size,
            readyCount = entries.count { it.status == PlaybackCacheStatus.READY },
            partialCount = entries.count { it.status == PlaybackCacheStatus.PARTIAL },
        )
    }

    fun clear(): PlaybackCacheSnapshot {
        cache.keys.toList().forEach(cache::removeResource)
        return snapshot()
    }

    fun mediaSourceFactory(registry: OriginUrlRegistry): MediaSource.Factory {
        val cacheDataSourceFactory = CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(RefreshingOriginDataSource.Factory(registry))
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
        return ProgressiveMediaSource.Factory(cacheDataSourceFactory)
    }

    fun release() {
        cache.release()
    }

    companion object {
        private const val AUDIO_CACHE_DIR = "audio_player_cache"
    }
}
