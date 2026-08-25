package cn.partialy.pm.network.discovery

import android.content.Context
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.CacheControl
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * 串行刷新服务发现文档，并原子发布“文档 + 已选 origin”。
 * 系统请求拦截器读取当前 origin，ConfigManager 使用返回快照绑定对应 bootstrap。
 */
class ServiceDiscoveryManager(
    embeddedBaseUrl: String,
    discoveryDocumentUrl: String = DEFAULT_DISCOVERY_DOCUMENT_URL,
    private val cache: ServiceDiscoveryCache,
    private val fetchDocument: suspend (String) -> String?,
    private val healthCheck: suspend (String) -> Boolean,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
) {
    constructor(
        context: Context,
        embeddedBaseUrl: String,
        discoveryDocumentUrl: String = DEFAULT_DISCOVERY_DOCUMENT_URL,
    ) : this(
        embeddedBaseUrl = embeddedBaseUrl,
        discoveryDocumentUrl = discoveryDocumentUrl,
        cache = ServiceDiscoveryPrefs(context),
        fetchDocument = { url -> DiscoveryNetwork.fetchDocument(url) },
        healthCheck = { url -> DiscoveryNetwork.checkHealth(url) },
    )

    private val embeddedDocument = createEmbeddedDocument(embeddedBaseUrl)
    private val discoveryDocumentUrl = validateDiscoveryDocumentUrl(discoveryDocumentUrl)
    private val refreshMutex = Mutex()
    private val current = AtomicReference(
        ResolvedDiscovery(
            snapshot = ServiceDiscoverySnapshot(ServiceDiscoverySource.EMBEDDED, embeddedDocument),
            origin = ServiceDiscoveryRules.orderedOrigins(embeddedDocument).first(),
        ),
    )

    fun currentSnapshot(): ServiceDiscoverySnapshot = current.get().snapshot

    /** 使用引用身份判断调用方持有的快照是否仍是当前原子快照。 */
    fun isCurrent(snapshot: ServiceDiscoverySnapshot): Boolean = current.get().snapshot === snapshot

    /** 与 discovery 刷新共用同一把锁，避免 current 校验与配置发布之间被新快照插入。 */
    suspend fun publishIfCurrent(
        snapshot: ServiceDiscoverySnapshot,
        publish: () -> Unit,
    ): Boolean = refreshMutex.withLock {
        if (current.get().snapshot !== snapshot) return@withLock false
        publish()
        true
    }

    fun resolveApiUrl(path: String): String = resolveAgainstOrigin(current.get().origin.apiBaseUrl, path)

    fun currentRealtimeBaseUrl(): String = current.get().origin.realtimeBaseUrl

    suspend fun refresh(): ServiceDiscoverySnapshot = refreshMutex.withLock {
        val previous = current.get()
        val currentVersion = previous.snapshot.document.configVersion
        val remoteRaw = fallbackOnFailure {
            withContext(ioDispatcher) { fetchDocument(discoveryDocumentUrl) }
        }
        val remoteDocument = remoteRaw?.let(ServiceDiscoveryRules::parseAndValidate)
        val cachedDocument = readValidatedCache()

        if (remoteRaw != null && remoteDocument != null && remoteDocument.configVersion >= currentVersion) {
            fallbackOnFailure {
                withContext(ioDispatcher) {
                    cache.saveIfNotOlder(remoteRaw, remoteDocument.configVersion)
                }
            }
        }

        val selectedDocument = ServiceDiscoveryRules.chooseDocument(
            remote = remoteDocument,
            cached = cachedDocument,
            currentVersion = currentVersion,
        )
        val selectedSnapshot = when {
            selectedDocument != null && selectedDocument === remoteDocument -> {
                ServiceDiscoverySnapshot(ServiceDiscoverySource.REMOTE, selectedDocument)
            }
            selectedDocument != null && selectedDocument === cachedDocument -> {
                ServiceDiscoverySnapshot(ServiceDiscoverySource.CACHE, selectedDocument)
            }
            embeddedDocument.configVersion >= currentVersion -> {
                ServiceDiscoverySnapshot(ServiceDiscoverySource.EMBEDDED, embeddedDocument)
            }
            else -> previous.snapshot
        }
        val selectedOrigin = selectHealthyOrigin(selectedSnapshot.document)
        val next = ResolvedDiscovery(snapshot = selectedSnapshot, origin = selectedOrigin)
        current.set(next)
        next.snapshot
    }

    private suspend fun readValidatedCache(): DiscoveryDocumentV1? {
        val cached = fallbackOnFailure {
            withContext(ioDispatcher) { cache.read() }
        } ?: return null
        val parsed = ServiceDiscoveryRules.parseAndValidate(cached.rawJson) ?: return null
        return parsed.takeIf { it.configVersion == cached.configVersion }
    }

    private suspend fun selectHealthyOrigin(document: DiscoveryDocumentV1): DiscoveryServiceOrigin {
        val origins = ServiceDiscoveryRules.orderedOrigins(document)
        val first = origins.first()
        for (origin in origins) {
            val healthUrl = resolveAgainstOrigin(origin.apiBaseUrl, document.desktop.healthCheckPath)
            val healthy = fallbackOnFailure {
                withContext(ioDispatcher) { healthCheck(healthUrl) }
            } ?: false
            if (healthy) return origin
        }
        return first
    }

    /** 普通 I/O 故障允许降级；协程取消必须原样向上传播。 */
    private suspend fun <T> fallbackOnFailure(block: suspend () -> T): T? = try {
        block()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Throwable) {
        null
    }

    private data class ResolvedDiscovery(
        val snapshot: ServiceDiscoverySnapshot,
        val origin: DiscoveryServiceOrigin,
    )

    companion object {
        const val DEFAULT_DISCOVERY_DOCUMENT_URL = "https://pisamusic.partialy.cn/pm-config/config-v1.json"

        private fun validateDiscoveryDocumentUrl(rawUrl: String): String {
            val url = requireNotNull(rawUrl.toHttpUrlOrNull()) { "非法服务发现文档地址" }
            require(
                url.isHttps &&
                    url.username.isEmpty() &&
                    url.password.isEmpty() &&
                    url.query == null &&
                    url.fragment == null,
            ) { "服务发现文档地址必须为无认证信息、query、fragment 的 HTTPS URL" }
            return url.toString()
        }

        private fun createEmbeddedDocument(rawBaseUrl: String): DiscoveryDocumentV1 {
            val baseUrl = requireNotNull(rawBaseUrl.toHttpUrlOrNull()) { "非法 embedded 服务地址" }
            require(baseUrl.scheme == "http" || baseUrl.scheme == "https") { "embedded 服务地址仅支持 HTTP(S)" }
            require(
                baseUrl.username.isEmpty() &&
                    baseUrl.password.isEmpty() &&
                    baseUrl.encodedPath == "/" &&
                    baseUrl.query == null &&
                    baseUrl.fragment == null,
            ) { "embedded 服务地址必须为纯 origin" }
            val origin = baseUrl.toString().removeSuffix("/")
            return DiscoveryDocumentV1(
                schemaVersion = 1,
                configVersion = EMBEDDED_CONFIG_VERSION,
                publishedAt = "1970-01-01T00:00:00Z",
                desktop = DiscoveryServiceBlock(
                    minimumSupportedVersion = "0.0.0",
                    healthCheckPath = "/api/health",
                    bootstrapPath = "/api/config/bootstrap",
                    serviceOrigins = listOf(
                        DiscoveryServiceOrigin(
                            id = "embedded",
                            priority = 0,
                            apiBaseUrl = origin,
                            realtimeBaseUrl = origin,
                        ),
                    ),
                    updateFeedBaseUrls = emptyList(),
                ),
            )
        }

        private fun resolveAgainstOrigin(rawOrigin: String, path: String): String {
            require(
                path.startsWith('/') &&
                    !path.startsWith("//") &&
                    '\\' !in path &&
                    '?' !in path &&
                    '#' !in path,
            ) { "服务路径必须是根相对路径: $path" }
            val origin = requireNotNull(rawOrigin.toHttpUrlOrNull()) { "非法服务 origin" }
            val resolved = requireNotNull(origin.resolve(path))
            require(sameOrigin(origin, resolved)) { "服务路径不得覆盖已选 origin: $path" }
            return resolved.toString()
        }

        private fun sameOrigin(left: HttpUrl, right: HttpUrl): Boolean =
            left.scheme == right.scheme && left.host == right.host && left.port == right.port

        private const val EMBEDDED_CONFIG_VERSION = 1
    }
}

private object DiscoveryNetwork {
    private val documentClient = OkHttpClient.Builder()
        .followRedirects(false)
        .followSslRedirects(false)
        .callTimeout(5, TimeUnit.SECONDS)
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .build()
    private val healthClient = OkHttpClient.Builder()
        .followRedirects(false)
        .followSslRedirects(false)
        .callTimeout(3, TimeUnit.SECONDS)
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .writeTimeout(3, TimeUnit.SECONDS)
        .build()

    fun fetchDocument(url: String): String? {
        val request = Request.Builder()
            .url(url)
            .get()
            .cacheControl(CacheControl.FORCE_NETWORK)
            .header("Cache-Control", "no-cache")
            .build()
        return documentClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return null
            response.body?.string()
        }
    }

    fun checkHealth(url: String): Boolean {
        val request = Request.Builder()
            .url(url)
            .get()
            .cacheControl(CacheControl.FORCE_NETWORK)
            .build()
        return healthClient.newCall(request).execute().use { it.isSuccessful }
    }
}
