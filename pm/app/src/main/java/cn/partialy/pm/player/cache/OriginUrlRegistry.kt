package cn.partialy.pm.player.cache

import cn.partialy.pm.model.DownloadQualityChoice
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.playbackQualityChoiceFromKey
import cn.partialy.pm.player.PlayUrlGetter
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException
import java.net.URI
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/** 取链所需的稳定描述；源站 URL 不属于描述的一部分。 */
data class OriginUrlDescriptor(
    val song: SongInfo,
    val qualityKey: String,
    val qualityChoice: DownloadQualityChoice? = playbackQualityChoiceFromKey(qualityKey),
)

/**
 * 进程内短期源站地址注册表。
 *
 * 每个缓存键独立串行取链，避免同一缓存缺口并发触发多次网络解析。解析结果不会落盘。
 */
@Singleton
class OriginUrlRegistry private constructor(
    private val resolver: suspend (OriginUrlDescriptor) -> String,
    private val nowMillis: () -> Long,
    private val ttlMillis: Long,
) {
    @Inject
    constructor(playUrlGetter: PlayUrlGetter) : this(
        resolver = { descriptor ->
            playUrlGetter.getUrl(descriptor.song, descriptor.qualityChoice).url
        },
        nowMillis = System::currentTimeMillis,
        ttlMillis = DEFAULT_TTL_MILLIS,
    )

    internal constructor(
        resolver: suspend (OriginUrlDescriptor) -> String,
        nowMillis: () -> Long,
    ) : this(resolver, nowMillis, DEFAULT_TTL_MILLIS)

    private data class ResolvedOrigin(
        val url: String,
        val resolvedAt: Long,
    )

    private val descriptors = ConcurrentHashMap<String, OriginUrlDescriptor>()
    private val resolvedOrigins = ConcurrentHashMap<String, ResolvedOrigin>()
    private val resolutionLocks = ConcurrentHashMap<String, Mutex>()

    fun register(cacheKey: String, descriptor: OriginUrlDescriptor) {
        require(cacheKey.isNotBlank()) { "cacheKey must not be blank" }
        descriptors[cacheKey] = descriptor
    }

    fun descriptor(cacheKey: String): OriginUrlDescriptor? = descriptors[cacheKey]

    suspend fun resolve(cacheKey: String): String {
        val descriptor = descriptors[cacheKey]
            ?: throw IOException("origin descriptor is not registered for cache key: $cacheKey")
        resolvedOrigins[cacheKey]?.takeIf(::isFresh)?.let { return it.url }

        return resolutionLocks.getOrPut(cacheKey) { Mutex() }.withLock {
            resolvedOrigins[cacheKey]?.takeIf(::isFresh)?.let { return@withLock it.url }
            val resolvedUrl = resolver(descriptor).requireHttpUrl()
            resolvedOrigins[cacheKey] = ResolvedOrigin(
                url = resolvedUrl,
                resolvedAt = nowMillis(),
            )
            resolvedUrl
        }
    }

    fun invalidate(cacheKey: String) {
        resolvedOrigins.remove(cacheKey)
    }

    private fun isFresh(origin: ResolvedOrigin): Boolean {
        val age = nowMillis() - origin.resolvedAt
        return age >= 0L && age < ttlMillis
    }

    private fun String.requireHttpUrl(): String {
        val parsed = runCatching { URI(this) }.getOrNull()
        if (parsed?.scheme !in HTTP_SCHEMES || parsed?.host.isNullOrBlank()) {
            throw IOException("play url resolver returned a non-HTTP URL")
        }
        return this
    }

    companion object {
        const val DEFAULT_TTL_MILLIS = 5 * 60 * 1000L
        private val HTTP_SCHEMES = setOf("http", "https")
    }
}
