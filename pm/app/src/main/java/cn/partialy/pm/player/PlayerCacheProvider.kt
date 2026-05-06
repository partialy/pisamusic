package cn.partialy.pm.player

import android.content.Context
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import cn.partialy.pm.utils.SettingsPrefs
import java.io.File

/**
 * ExoPlayer 音频缓存组件提供器。
 * 单例维护 SimpleCache，按设置中的最大缓存空间创建/重建。
 */
object PlayerCacheProvider {
    private const val AUDIO_CACHE_DIR = "audio_player_cache"

    @Volatile
    private var simpleCache: SimpleCache? = null
    @Volatile
    private var currentMaxBytes: Long = -1L

    @Synchronized
    private fun cache(context: Context): SimpleCache {
        val appCtx = context.applicationContext
        val maxBytes = SettingsPrefs.getAudioCacheMaxBytes(appCtx)
        val existing = simpleCache
        if (existing != null && currentMaxBytes == maxBytes) return existing
        existing?.release()

        val dir = File(appCtx.cacheDir, AUDIO_CACHE_DIR).apply { mkdirs() }
        val created = SimpleCache(
            dir,
            LeastRecentlyUsedCacheEvictor(maxBytes),
            StandaloneDatabaseProvider(appCtx),
        )
        simpleCache = created
        currentMaxBytes = maxBytes
        return created
    }

    fun buildCacheDataSourceFactory(context: Context): CacheDataSource.Factory {
        val appCtx = context.applicationContext
        return CacheDataSource.Factory()
            .setCache(cache(appCtx))
            .setUpstreamDataSourceFactory(DefaultDataSource.Factory(appCtx))
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    }

    @Synchronized
    fun release() {
        simpleCache?.release()
        simpleCache = null
        currentMaxBytes = -1L
    }
}
