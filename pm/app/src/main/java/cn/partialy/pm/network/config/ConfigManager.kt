package cn.partialy.pm.network.config

import cn.partialy.pm.model.BootstrapEndpoints
import cn.partialy.pm.model.AgreementInfo
import cn.partialy.pm.model.AboutInfo
import cn.partialy.pm.model.UpdateInfo
import cn.partialy.pm.model.DeviceReportRequest
import cn.partialy.pm.model.DeviceReportResult
import cn.partialy.pm.model.SyncBindRequest
import cn.partialy.pm.model.SyncBindResult
import cn.partialy.pm.model.SyncChangeInput
import cn.partialy.pm.model.SyncChangesResult
import cn.partialy.pm.model.SyncPushRequest
import cn.partialy.pm.model.SyncPushResult
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.gateway.GatewaySignConfig
import cn.partialy.pm.network.gateway.GatewaySignRuntime
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ConfigManager @Inject constructor(
    private val systemApiService: SystemApiService,
) {
    class ApiException(val code: Int, override val message: String) : RuntimeException(message)

    data class RuntimeEndpoints(
        val kgBaseUrl: String,
        val wyBaseUrl: String,
        val proxyBaseUrl: String,
        val kwBaseUrl: String,
        val kgSongUrl: String,
        val wySongUrl: String,
        val wySongUrlV1: String,
    )

    data class RuntimeGatewaySign(
        val secret: String,
        val asValue: String,
    )

    @Volatile
    private var runtimeEndpoints: RuntimeEndpoints = DEFAULT_ENDPOINTS

    @Volatile
    private var runtimeGatewaySign: RuntimeGatewaySign = DEFAULT_GATEWAY_SIGN

    fun getEndpoints(): RuntimeEndpoints = runtimeEndpoints
    fun getGatewaySign(): RuntimeGatewaySign = runtimeGatewaySign

    fun getKgBaseUrl(): String = runtimeEndpoints.kgBaseUrl
    fun getWyBaseUrl(): String = runtimeEndpoints.wyBaseUrl
    fun getProxyBaseUrl(): String = runtimeEndpoints.proxyBaseUrl
    fun getKwBaseUrl(): String = runtimeEndpoints.kwBaseUrl
    fun getKgSongUrl(): String = runtimeEndpoints.kgSongUrl
    fun getWySongUrl(): String = runtimeEndpoints.wySongUrl
    fun getWySongUrlV1(): String = runtimeEndpoints.wySongUrlV1

    suspend fun refreshBootstrapConfig() {
        val response = systemApiService.getBootstrapConfig()
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "配置下发失败" })
        }
        val endpoints = response.data.endpoints.toRuntimeEndpoints()
        val gatewaySign = RuntimeGatewaySign(
            secret = response.data.gatewaySign.secret.ifBlank { DEFAULT_GATEWAY_SIGN.secret },
            asValue = response.data.gatewaySign.`as`.ifBlank { DEFAULT_GATEWAY_SIGN.asValue },
        )
        runtimeEndpoints = endpoints
        runtimeGatewaySign = gatewaySign
        GatewaySignRuntime.update(
            config = GatewaySignConfig(
                secret = gatewaySign.secret,
                asValue = gatewaySign.asValue,
            ),
            endpointUrls = endpoints.asUrlList(),
        )
    }

    suspend fun getUpdateInfo(): UpdateInfo {
        val response = systemApiService.getCheckUpdate()
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "更新信息获取失败" })
        }
        return response.data
    }

    suspend fun getAgreementInfo(): AgreementInfo {
        val response = systemApiService.getAgreement()
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "用户协议获取失败" })
        }
        return response.data
    }

    suspend fun getServiceAgreementInfo(): AgreementInfo {
        val response = systemApiService.getServiceAgreement()
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "服务协议获取失败" })
        }
        return response.data
    }

    suspend fun getPrivacyPolicyInfo(): AgreementInfo {
        val response = systemApiService.getPrivacyPolicy()
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "隐私政策获取失败" })
        }
        return response.data
    }

    suspend fun getAboutInfo(): AboutInfo {
        val response = systemApiService.getAbout()
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "关于信息获取失败" })
        }
        return response.data
    }

    suspend fun reportDevice(body: DeviceReportRequest): DeviceReportResult {
        val response = systemApiService.reportDevice(body)
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "设备信息上报失败" })
        }
        return response.data
    }

    suspend fun createSyncSpace(deviceName: String): SyncBindResult {
        val response = systemApiService.createSyncSpace(SyncBindRequest(deviceName = deviceName))
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "创建同步码失败" })
        }
        return response.data
    }

    suspend fun joinSyncSpace(syncCode: String, deviceName: String): SyncBindResult {
        val response = systemApiService.joinSyncSpace(
            SyncBindRequest(syncCode = syncCode, deviceName = deviceName)
        )
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "加入同步空间失败" })
        }
        return response.data
    }

    suspend fun resetSyncSpace(token: String, deviceName: String): SyncBindResult {
        val response = systemApiService.resetSyncSpace(
            "Bearer $token",
            SyncBindRequest(deviceName = deviceName)
        )
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "重新生成同步码失败" })
        }
        return response.data
    }

    suspend fun getSyncChanges(token: String, since: Long): SyncChangesResult {
        val response = systemApiService.getSyncChanges("Bearer $token", since)
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "拉取同步变更失败" })
        }
        return response.data
    }

    suspend fun pushSyncChanges(token: String, changes: List<SyncChangeInput>): SyncPushResult {
        val response = systemApiService.pushSyncChanges("Bearer $token", SyncPushRequest(changes))
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "推送同步变更失败" })
        }
        return response.data
    }

    suspend fun unbindSyncDevice(token: String): Boolean {
        val response = systemApiService.unbindSyncDevice("Bearer $token")
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "解绑同步设备失败" })
        }
        return response.data.unbound
    }

    /**
     * 兼容历史调用。当前改为刷新整份运行时配置，不再落盘。
     */
    suspend fun getLatestBaseUrl(): String {
        refreshBootstrapConfig()
        return getKgBaseUrl()
    }

    private fun BootstrapEndpoints.toRuntimeEndpoints(): RuntimeEndpoints {
        val kgBase = normalizeBaseUrl(kgBaseUrl)
        val wyBase = normalizeBaseUrl(wyBaseUrl)
        val proxyBase = normalizeBaseUrl(proxyBaseUrl)
        val kwBase = normalizeBaseUrl(kwBaseUrl)
        val kgSong = normalizeAbsoluteUrl(kgSongUrl)
        val wySong = normalizeAbsoluteUrl(wySongUrl)
        val wySongV1 = normalizeAbsoluteUrl(wySongUrlV1)
        return RuntimeEndpoints(
            kgBaseUrl = kgBase,
            wyBaseUrl = wyBase,
            proxyBaseUrl = proxyBase,
            kwBaseUrl = kwBase,
            kgSongUrl = kgSong,
            wySongUrl = wySong,
            wySongUrlV1 = wySongV1,
        )
    }

    private fun RuntimeEndpoints.asUrlList(): List<String> = listOf(
        kgBaseUrl,
        wyBaseUrl,
        proxyBaseUrl,
        kwBaseUrl,
        kgSongUrl,
        wySongUrl,
        wySongUrlV1,
    )

    private fun normalizeBaseUrl(raw: String): String {
        val trimmed = raw.trim()
        require(trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            "非法 baseUrl: $raw"
        }
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }

    private fun normalizeAbsoluteUrl(raw: String): String {
        val trimmed = raw.trim()
        require(trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            "非法 URL: $raw"
        }
        return trimmed
    }

    companion object {
        private val DEFAULT_ENDPOINTS = RuntimeEndpoints(
            kgBaseUrl = "",
            wyBaseUrl = "",
            proxyBaseUrl = "",
            kwBaseUrl = "",
            kgSongUrl = "",
            wySongUrl = "",
            wySongUrlV1 = "",
        )
        private val DEFAULT_GATEWAY_SIGN = RuntimeGatewaySign(
            secret = "partialypartialypartialypartialy",
            asValue = "yixivip",
        )
    }
}
