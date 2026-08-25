package cn.partialy.pm.network.discovery

import java.time.OffsetDateTime
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/** 服务发现文档的纯解析、校验与选源规则。 */
object ServiceDiscoveryRules {
    private val json = Json {
        ignoreUnknownKeys = false
    }

    fun parseAndValidate(raw: String): DiscoveryDocumentV1? = runCatching {
        val dto = json.decodeFromString<DiscoveryDocumentDto>(raw)
        dto.toDocument()
    }.getOrNull()

    /**
     * 只以 configVersion 决定新旧：不能使用低于当前版本的远程或缓存文档；版本相同时远程优先。
     * 返回 null 时由调用方使用内置文档。
     */
    fun chooseDocument(
        remote: DiscoveryDocumentV1?,
        cached: DiscoveryDocumentV1?,
        currentVersion: Int,
    ): DiscoveryDocumentV1? {
        val remoteCandidate = remote?.takeIf { it.configVersion >= currentVersion }
        val cacheCandidate = cached?.takeIf { it.configVersion >= currentVersion }
        return when {
            remoteCandidate == null -> cacheCandidate
            cacheCandidate == null -> remoteCandidate
            remoteCandidate.configVersion >= cacheCandidate.configVersion -> remoteCandidate
            else -> cacheCandidate
        }
    }

    /** priority 越小越先尝试；使用输入下标确保同 priority 时保持文档中的顺序。 */
    fun orderedOrigins(document: DiscoveryDocumentV1): List<DiscoveryServiceOrigin> =
        document.desktop.serviceOrigins
            .withIndex()
            .sortedWith(compareBy<IndexedValue<DiscoveryServiceOrigin>> { it.value.priority }.thenBy { it.index })
            .map { it.value }

    /** 仅接受已经过校验的根相对 path，避免 path 覆盖 origin。 */
    fun resolveRelative(origin: DiscoveryServiceOrigin, path: String): String {
        require(isRootRelativePath(path)) { "服务路径必须是根相对路径: $path" }
        val apiBaseUrl = validatedPureHttpsOrigin(origin.apiBaseUrl).toHttpUrlOrNull()
            ?: error("非法服务 origin: ${origin.apiBaseUrl}")
        val resolvedUrl = requireNotNull(apiBaseUrl.resolve(path))
        require(
            resolvedUrl.scheme == apiBaseUrl.scheme &&
                resolvedUrl.host == apiBaseUrl.host &&
                resolvedUrl.port == apiBaseUrl.port,
        ) { "服务路径不得覆盖已选 origin: $path" }
        return resolvedUrl.toString()
    }

    private fun DiscoveryDocumentDto.toDocument(): DiscoveryDocumentV1 {
        require(schemaVersion == SCHEMA_VERSION) { "不支持的 discovery schema" }
        val validConfigVersion = requireNotNull(configVersion).also {
            require(it > 0) { "configVersion 必须为正数" }
        }
        val validPublishedAt = requireNotNull(publishedAt).also {
            OffsetDateTime.parse(it)
        }
        val validDesktop = requireNotNull(desktop).toServiceBlock()
        return DiscoveryDocumentV1(
            schemaVersion = schemaVersion,
            configVersion = validConfigVersion,
            publishedAt = validPublishedAt,
            desktop = validDesktop,
        )
    }

    private fun DiscoveryServiceBlockDto.toServiceBlock(): DiscoveryServiceBlock {
        val validMinimumSupportedVersion = requireNotNull(minimumSupportedVersion).trim()
        require(validMinimumSupportedVersion.isNotEmpty()) { "minimumSupportedVersion 不能为空" }
        val validHealthCheckPath = requireNotNull(healthCheckPath)
            .takeIf(::isRootRelativePath)
            ?: error("healthCheckPath 必须是根相对路径")
        val validBootstrapPath = requireNotNull(bootstrapPath)
            .takeIf(::isRootRelativePath)
            ?: error("bootstrapPath 必须是根相对路径")
        val validOrigins = requireNotNull(serviceOrigins)
            .map { it.toOrigin() }
            .also { require(it.isNotEmpty()) { "serviceOrigins 不能为空" } }
        require(validOrigins.map(DiscoveryServiceOrigin::id).toSet().size == validOrigins.size) {
            "service origin id 不可重复"
        }
        val validUpdateFeedBaseUrls = requireNotNull(updateFeedBaseUrls)
            .map(::validatedUpdateFeedBaseUrl)
            .also { require(it.isNotEmpty()) { "updateFeedBaseUrls 不能为空" } }
        return DiscoveryServiceBlock(
            minimumSupportedVersion = validMinimumSupportedVersion,
            healthCheckPath = validHealthCheckPath,
            bootstrapPath = validBootstrapPath,
            serviceOrigins = validOrigins,
            updateFeedBaseUrls = validUpdateFeedBaseUrls,
        )
    }

    private fun DiscoveryServiceOriginDto.toOrigin(): DiscoveryServiceOrigin {
        val validId = requireNotNull(id).trim()
        require(validId.isNotEmpty()) { "service origin id 不能为空" }
        return DiscoveryServiceOrigin(
            id = validId,
            priority = requireNotNull(priority),
            apiBaseUrl = validatedPureHttpsOrigin(requireNotNull(apiBaseUrl)),
            realtimeBaseUrl = validatedPureHttpsOrigin(requireNotNull(realtimeBaseUrl)),
        )
    }

    private fun validatedPureHttpsOrigin(raw: String): String {
        val url = raw.toHttpUrlOrNull() ?: error("非法服务 origin")
        require(
            url.isHttps &&
                url.username.isEmpty() &&
                url.password.isEmpty() &&
                url.encodedPath == "/" &&
                url.query == null &&
                url.fragment == null,
        ) { "服务 origin 必须为纯 HTTPS origin" }
        return url.toString().removeSuffix("/")
    }

    private fun validatedUpdateFeedBaseUrl(raw: String): String {
        val url = raw.toHttpUrlOrNull() ?: error("非法更新地址")
        require(
            url.isHttps &&
                url.username.isEmpty() &&
                url.password.isEmpty() &&
                url.query == null &&
                url.fragment == null,
        ) { "更新地址必须是无认证信息、query、fragment 的 HTTPS URL" }
        return url.toString().removeSuffix("/")
    }

    private fun isRootRelativePath(path: String): Boolean =
        path.startsWith('/') &&
            !path.startsWith("//") &&
            '\\' !in path &&
            '?' !in path &&
            '#' !in path

    private const val SCHEMA_VERSION = 1
}

@Serializable
private data class DiscoveryDocumentDto(
    val schemaVersion: Int,
    val configVersion: Int? = null,
    val publishedAt: String? = null,
    val desktop: DiscoveryServiceBlockDto? = null,
)

@Serializable
private data class DiscoveryServiceBlockDto(
    val minimumSupportedVersion: String? = null,
    val healthCheckPath: String? = null,
    val bootstrapPath: String? = null,
    val serviceOrigins: List<DiscoveryServiceOriginDto>? = null,
    val updateFeedBaseUrls: List<String>? = null,
)

@Serializable
private data class DiscoveryServiceOriginDto(
    val id: String? = null,
    val priority: Int? = null,
    val apiBaseUrl: String? = null,
    val realtimeBaseUrl: String? = null,
)
