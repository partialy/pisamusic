package cn.partialy.pm.network.config

import cn.partialy.pm.model.AboutInfo
import cn.partialy.pm.model.AccountAuthResult
import cn.partialy.pm.model.AccountCodeLoginRequest
import cn.partialy.pm.model.AccountEmailCodeRequest
import cn.partialy.pm.model.AccountPasswordLoginRequest
import cn.partialy.pm.model.AccountPasswordResetRequest
import cn.partialy.pm.model.AccountProfileEmailCodeRequest
import cn.partialy.pm.model.AccountProfileUpdateRequest
import cn.partialy.pm.model.AccountRegisterRequest
import cn.partialy.pm.model.AccountUser
import cn.partialy.pm.model.AgreementInfo
import cn.partialy.pm.model.BootstrapEndpoints
import cn.partialy.pm.model.DeviceReportRequest
import cn.partialy.pm.model.DeviceReportResult
import cn.partialy.pm.model.DynamicConfigInfo
import cn.partialy.pm.model.SyncChangeInput
import cn.partialy.pm.model.SyncChangesResult
import cn.partialy.pm.model.SyncPushRequest
import cn.partialy.pm.model.SyncPushResult
import cn.partialy.pm.model.UpdateInfo
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
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "更新信息获取失败" })
        return response.data
    }

    suspend fun getAgreementInfo(): AgreementInfo {
        val response = systemApiService.getAgreement()
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "用户协议获取失败" })
        return response.data
    }

    suspend fun getServiceAgreementInfo(): AgreementInfo {
        val response = systemApiService.getServiceAgreement()
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "服务协议获取失败" })
        return response.data
    }

    suspend fun getPrivacyPolicyInfo(): AgreementInfo {
        val response = systemApiService.getPrivacyPolicy()
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "隐私政策获取失败" })
        return response.data
    }

    suspend fun getAboutInfo(): AboutInfo {
        val response = systemApiService.getAbout()
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "关于信息获取失败" })
        return response.data
    }

    suspend fun getDynamicConfigInfo(id: String): DynamicConfigInfo {
        val response = systemApiService.getDynamicConfig(id)
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "动态配置获取失败" })
        return response.data
    }

    suspend fun reportDevice(body: DeviceReportRequest): DeviceReportResult {
        val response = systemApiService.reportDevice(body)
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "设备信息上报失败" })
        return response.data
    }

    suspend fun sendAccountEmailCode(email: String, purpose: String) {
        val response = systemApiService.sendAccountEmailCode(AccountEmailCodeRequest(email, purpose))
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "验证码发送失败" })
    }

    suspend fun registerAccount(email: String, username: String, password: String, code: String): AccountAuthResult {
        val response = systemApiService.registerAccount(AccountRegisterRequest(email, username, password, code))
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "注册失败" })
        return response.data
    }

    suspend fun loginAccountByPassword(identifier: String, password: String): AccountAuthResult {
        val response = systemApiService.loginAccountByPassword(AccountPasswordLoginRequest(identifier, password))
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "登录失败" })
        return response.data
    }

    suspend fun loginAccountByCode(email: String, code: String): AccountAuthResult {
        val response = systemApiService.loginAccountByCode(AccountCodeLoginRequest(email, code))
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "登录失败" })
        return response.data
    }

    suspend fun resetAccountPassword(email: String, code: String, password: String) {
        val response = systemApiService.resetAccountPassword(AccountPasswordResetRequest(email, code, password))
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "密码重置失败" })
    }

    suspend fun refreshAccountToken(token: String): AccountAuthResult {
        val response = systemApiService.refreshAccountToken("Bearer $token")
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "刷新登录失败" })
        return response.data
    }

    suspend fun getAccountMe(token: String): AccountUser {
        val response = systemApiService.getAccountMe("Bearer $token")
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "账号信息获取失败" })
        return response.data
    }

    suspend fun sendAccountProfileEmailCode(token: String, email: String) {
        val response = systemApiService.sendAccountProfileEmailCode(
            authorization = "Bearer $token",
            body = AccountProfileEmailCodeRequest(email),
        )
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "验证码发送失败" })
        }
    }

    suspend fun updateAccountProfile(
        token: String,
        username: String?,
        email: String?,
        code: String?,
        avatarKey: String?,
    ): AccountAuthResult {
        val response = systemApiService.updateAccountProfile(
            authorization = "Bearer $token",
            body = AccountProfileUpdateRequest(
                username = username,
                email = email,
                code = code,
                avatarKey = avatarKey,
            ),
        )
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "资料更新失败" })
        }
        return response.data
    }

    suspend fun getSyncChanges(token: String, deviceId: String, since: Long): SyncChangesResult {
        val response = systemApiService.getSyncChanges("Bearer $token", deviceId, since)
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "拉取同步变更失败" })
        return response.data
    }

    suspend fun pushSyncChanges(token: String, deviceId: String, changes: List<SyncChangeInput>): SyncPushResult {
        val response = systemApiService.pushSyncChanges("Bearer $token", deviceId, SyncPushRequest(changes))
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "推送同步变更失败" })
        return response.data
    }

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
            kgBaseUrl = "http://127.0.0.1/",
            wyBaseUrl = "http://127.0.0.1/",
            proxyBaseUrl = "http://127.0.0.1/",
            kwBaseUrl = "http://127.0.0.1/",
            kgSongUrl = "http://127.0.0.1/",
            wySongUrl = "http://127.0.0.1/",
            wySongUrlV1 = "http://127.0.0.1/",
        )
        private val DEFAULT_GATEWAY_SIGN = RuntimeGatewaySign(
            secret = "partialypartialypartialypartialy",
            asValue = "yixivip",
        )
    }
}
