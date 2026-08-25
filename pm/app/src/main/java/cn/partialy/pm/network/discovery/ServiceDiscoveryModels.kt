package cn.partialy.pm.network.discovery

/** 已验证的服务发现文档。 */
data class DiscoveryDocumentV1(
    val schemaVersion: Int,
    val configVersion: Int,
    val publishedAt: String,
    val desktop: DiscoveryServiceBlock,
)

/** 当前 discovery 文档中复用的 desktop 服务段。 */
data class DiscoveryServiceBlock(
    val minimumSupportedVersion: String,
    val healthCheckPath: String,
    val bootstrapPath: String,
    val serviceOrigins: List<DiscoveryServiceOrigin>,
    val updateFeedBaseUrls: List<String>,
)

/** 可供系统服务使用的纯 origin。 */
data class DiscoveryServiceOrigin(
    val id: String,
    val priority: Int,
    val apiBaseUrl: String,
    val realtimeBaseUrl: String,
)

/** 当前服务发现快照的来源与不可变文档。 */
data class ServiceDiscoverySnapshot(
    val source: ServiceDiscoverySource,
    val document: DiscoveryDocumentV1,
)

enum class ServiceDiscoverySource {
    REMOTE,
    CACHE,
    EMBEDDED,
}
