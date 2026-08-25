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
            resolveAndStore(cacheKey, descriptor)
        }
    }

    /**
     * 仅当当前地址仍是本次被源站拒绝的旧地址时刷新。
     *
     * 并发请求若已先完成刷新，后到的旧地址 401/403 直接复用新地址，不能把它再次失效。
     */
    suspend fun refreshAfterRejection(cacheKey: String, rejectedUrl: String): String {
        val descriptor = descriptors[cacheKey]
            ?: throw IOException("origin descriptor is not registered for cache key: $cacheKey")
        return resolutionLocks.getOrPut(cacheKey) { Mutex() }.withLock {
            resolvedOrigins[cacheKey]
                ?.takeIf(::isFresh)
                ?.takeIf { it.url != rejectedUrl }
                ?.let { return@withLock it.url }
            resolveAndStore(cacheKey, descriptor)
        }
    }

    /** 仅在播放器彻底释放后调用，活跃队列期间不淘汰 descriptor。 */
    fun clear() {
        descriptors.clear()
        resolvedOrigins.clear()
        resolutionLocks.clear()
    }

    private suspend fun resolveAndStore(
        cacheKey: String,
        descriptor: OriginUrlDescriptor,
    ): String {
        val resolvedUrl = resolver(descriptor).requireHttpUrl()
        resolvedOrigins[cacheKey] = ResolvedOrigin(
            url = resolvedUrl,
            resolvedAt = nowMillis(),
        )
        return resolvedUrl
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
