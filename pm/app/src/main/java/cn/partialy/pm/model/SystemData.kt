package cn.partialy.pm.model

/**
 * 启动配置下发响应（兼容 success 字段）。
 */
data class BootstrapConfigResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: BootstrapConfigData,
)

data class BootstrapConfigData(
    val version: String? = null,
    val updatedAt: Long? = null,
    val endpoints: BootstrapEndpoints,
    val gatewaySign: GatewaySignConfig = GatewaySignConfig(),
)

data class BootstrapEndpoints(
    val kgBaseUrl: String,
    val wyBaseUrl: String,
    val proxyBaseUrl: String,
    val kwBaseUrl: String,
    val kgSongUrl: String,
    val wySongUrl: String,
    val wySongUrlV1: String,
)

data class GatewaySignConfig(
    val secret: String = "partialypartialypartialypartialy",
    val `as`: String = "yixivip",
)

data class CheckUpdateResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: UpdateInfo,
)

data class DiscoverResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: DiscoverInfo,
)

data class DiscoverInfo(
    val url: String,
    val updatedAt: Long,
)

data class UpdateInfo(
    val latestVersion: String,
    val updateTime: String,
    val forceUpdate: Boolean,
    val downloadUrl: String,
    val officialUrl: String,
    val updateContent: String,
)

data class AgreementResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: AgreementInfo,
)

data class AgreementInfo(
    val title: String,
    val content: String,
)

data class AboutResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: AboutInfo,
)

data class AboutInfo(
    val appName: String,
    val websiteLabel: String,
    val websiteUrl: String,
    val description: String,
    val team: String,
    val copyright: String,
)

data class AnnouncementResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: List<AnnouncementItem>,
)

data class AnnouncementItem(
    val id: String,
    val content: String,
    val time: String,
    val publisher: String,
    val confirmText: String,
    val showEveryTime: Boolean = false,
    val showGotoButton: Boolean,
    val gotoUrl: String? = null,
)
