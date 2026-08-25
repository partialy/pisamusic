package cn.partialy.pm.player.cache

import android.net.Uri
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.TransferListener
import kotlinx.coroutines.runBlocking
import java.io.IOException
import java.net.URI
import java.util.concurrent.CopyOnWriteArrayList

/** 严格解析 `pmcache://media/<64 lowercase hex>` 逻辑媒体地址。 */
object LogicalMediaUri {
    private val CACHE_KEY_PATTERN = Regex("[a-f0-9]{64}")

    fun create(cacheKey: String): URI {
        require(CACHE_KEY_PATTERN.matches(cacheKey)) { "invalid cache key" }
        return URI.create("${CacheIdentity.LOGICAL_URI_PREFIX}$cacheKey")
    }

    fun parse(uri: URI): String? {
        if (uri.scheme != SCHEME || uri.host != HOST) return null
        if (uri.userInfo != null || uri.port != -1 || uri.query != null || uri.fragment != null) return null
        val path = uri.path ?: return null
        if (!path.startsWith('/') || path.indexOf('/', startIndex = 1) >= 0) return null
        return path.substring(1).takeIf(CACHE_KEY_PATTERN::matches)
    }

    fun parse(value: String): String? = runCatching { URI(value) }
        .getOrNull()
        ?.let(::parse)

    private const val SCHEME = "pmcache"
    private const val HOST = "media"
}

/**
 * 仅在 Media3 发现缓存缺口时，把逻辑 URI 换成本次有效的 HTTP URI。
 */
@UnstableApi
class RefreshingOriginDataSource private constructor(
    private val registry: OriginUrlRegistry,
    private val httpDataSourceFactory: DataSource.Factory,
) : DataSource {
    private val transferListeners = CopyOnWriteArrayList<TransferListener>()
    private var activeDelegate: DataSource? = null
    private var logicalUri: Uri? = null

    override fun addTransferListener(transferListener: TransferListener) {
        transferListeners += transferListener
        activeDelegate?.addTransferListener(transferListener)
    }

    override fun open(dataSpec: DataSpec): Long {
        close()
        val cacheKey = LogicalMediaUri.parse(dataSpec.uri.toString())
            ?: throw IOException("unsupported logical media URI: ${dataSpec.uri}")
        if (registry.descriptor(cacheKey) == null) {
            throw IOException("origin descriptor is not registered for cache key: $cacheKey")
        }
        logicalUri = dataSpec.uri

        return try {
            val resolvedUrl = registry.resolveBlocking(cacheKey)
            try {
                openFreshDelegate(dataSpec.withResolvedUri(resolvedUrl))
            } catch (error: HttpDataSource.InvalidResponseCodeException) {
                if (error.responseCode != 401 && error.responseCode != 403) throw error
                val refreshedUrl = registry.refreshAfterRejectionBlocking(cacheKey, resolvedUrl)
                openFreshDelegate(dataSpec.withResolvedUri(refreshedUrl))
            }
        } catch (error: Throwable) {
            logicalUri = null
            throw error
        }
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int =
        activeDelegate?.read(buffer, offset, length)
            ?: throw IOException("data source is not open")

    // CacheDataSource 只能看到逻辑 URI，禁止把源站 URL 写入 redirected URI metadata。
    override fun getUri(): Uri? = logicalUri

    override fun getResponseHeaders(): Map<String, List<String>> =
        activeDelegate?.responseHeaders ?: emptyMap()

    override fun close() {
        logicalUri = null
        closeDelegate()
    }

    private fun closeDelegate() {
        val delegate = activeDelegate
        activeDelegate = null
        delegate?.close()
    }

    private fun openFreshDelegate(dataSpec: DataSpec): Long {
        closeDelegate()
        val delegate = httpDataSourceFactory.createDataSource()
        transferListeners.forEach(delegate::addTransferListener)
        activeDelegate = delegate
        return try {
            delegate.open(dataSpec)
        } catch (error: Throwable) {
            activeDelegate = null
            try {
                delegate.close()
            } catch (closeError: Throwable) {
                error.addSuppressed(closeError)
            }
            throw error
        }
    }

    private fun OriginUrlRegistry.resolveBlocking(cacheKey: String): String =
        runBlocking { resolve(cacheKey) }

    private fun OriginUrlRegistry.refreshAfterRejectionBlocking(
        cacheKey: String,
        rejectedUrl: String,
    ): String = runBlocking { refreshAfterRejection(cacheKey, rejectedUrl) }

    private fun DataSpec.withResolvedUri(url: String): DataSpec = buildUpon()
        .setUri(Uri.parse(url))
        .build()

    class Factory(
        private val registry: OriginUrlRegistry,
        private val httpDataSourceFactory: DataSource.Factory = defaultHttpFactory(),
    ) : DataSource.Factory {
        override fun createDataSource(): DataSource =
            RefreshingOriginDataSource(registry, httpDataSourceFactory)

        companion object {
            private const val HTTP_TIMEOUT_MILLIS = 20_000

            private fun defaultHttpFactory(): DataSource.Factory =
                DefaultHttpDataSource.Factory()
                    .setConnectTimeoutMs(HTTP_TIMEOUT_MILLIS)
                    .setReadTimeoutMs(HTTP_TIMEOUT_MILLIS)
        }
    }
}
