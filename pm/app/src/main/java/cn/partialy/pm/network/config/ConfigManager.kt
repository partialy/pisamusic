package cn.partialy.pm.network.config

import android.util.Log
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.model.AboutInfo
import cn.partialy.pm.model.AccountAuthResult
import cn.partialy.pm.model.AccountAvatarUploadToken
import cn.partialy.pm.model.AccountAvatarUploadTokenRequest
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
import cn.partialy.pm.network.discovery.ServiceDiscoveryManager
import cn.partialy.pm.network.discovery.ServiceDiscoverySnapshot
import cn.partialy.pm.network.gateway.GatewaySignRuntime
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import retrofit2.HttpException

@Singleton
class ConfigManager @Inject constructor(
    private val systemApiService: SystemApiService,
    private val serviceDiscoveryManager: ServiceDiscoveryManager,
) {
    class ApiException(
        val code: Int,
        override val message: String,
        val httpStatus: Int? = null,
    ) : RuntimeException(message)

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

    data class RuntimeBootstrapState(
        val endpoints: RuntimeEndpoints,
        val gatewaySign: RuntimeGatewaySign,
        val gatewayEndpointPrefixes: Set<String>,
    )

    internal data class RuntimeUrlTarget(
        val url: String,
        val state: RuntimeBootstrapState,
    )

    private val bootstrapMutex = Mutex()
    private val runtimeStateLock = Any()
    private var runtimeGeneration = 0L

    @Volatile
    private var localMode = false

    private val runtimeBootstrapState = AtomicReference(
        createUnavailableState(),
    )

    init {
        GatewaySignRuntime.bind(runtimeBootstrapState::get)
    }

    internal fun getEndpoints(): RuntimeEndpoints = runtimeBootstrapState.get().endpoints
    internal fun getGatewaySign(): RuntimeGatewaySign = runtimeBootstrapState.get().gatewaySign
    internal fun captureRuntimeState(): RuntimeBootstrapState = runtimeBootstrapState.get()
    internal fun getRuntimeBootstrapState(): RuntimeBootstrapState = captureRuntimeState()

    internal fun kgSongTarget(): RuntimeUrlTarget = runtimeTarget(RuntimeEndpoints::kgSongUrl)
    internal fun wySongTarget(): RuntimeUrlTarget = runtimeTarget(RuntimeEndpoints::wySongUrl)
    internal fun wySongV1Target(): RuntimeUrlTarget = runtimeTarget(RuntimeEndpoints::wySongUrlV1)
    internal fun kgApiTarget(path: String): RuntimeUrlTarget = runtimePathTarget(RuntimeEndpoints::kgBaseUrl, path)
    internal fun wyApiTarget(path: String): RuntimeUrlTarget = runtimePathTarget(RuntimeEndpoints::wyBaseUrl, path)

    fun beginOnlineStartup() = synchronized(runtimeStateLock) {
        runtimeGeneration++
        localMode = false
        runtimeBootstrapState.set(createUnavailableState())
    }

    fun enterLocalMode() = synchronized(runtimeStateLock) {
        runtimeGeneration++
        localMode = true
        runtimeBootstrapState.set(createUnavailableState())
    }

    fun isLocalMode(): Boolean = localMode

    private suspend fun <T> systemCall(fallbackMessage: String, block: suspend () -> T): T {
        return try {
            block()
        } catch (e: HttpException) {
            throw e.toApiException(fallbackMessage)
        }
    }

    private fun HttpException.toApiException(fallbackMessage: String): ApiException {
        val httpStatus = code()
        val parsed = response()?.errorBody()?.string()
            ?.takeIf { it.isNotBlank() }
            ?.let { raw -> runCatching { JSONObject(raw) }.getOrNull() }
        val apiCode = parsed?.optInt("code", httpStatus) ?: httpStatus
        val apiMessage = parsed?.optString("msg").orEmpty()
        val message = apiMessage.ifBlank {
            message().takeIf { it.isNotBlank() } ?: fallbackMessage
        }
        return ApiException(apiCode, message, httpStatus)
    }

    suspend fun refreshServiceDiscovery(): ServiceDiscoverySnapshot = serviceDiscoveryManager.refresh()

    /** 将服务端相对资源地址绑定到当前 discovery origin，拒绝明文或非法外部地址。 */
    fun resolveSystemUrl(raw: String): String? {
        val value = raw.trim()
        if (value.isBlank()) return null
        val absoluteUrl = value.toHttpUrlOrNull()
        if (absoluteUrl != null) {
            return when {
                absoluteUrl.isHttps -> absoluteUrl.toString()
                absoluteUrl.scheme == "http" -> absoluteUrl.newBuilder()
                    .scheme("https")
                    .build()
                    .toString()
                else -> null
            }
        }
        if (!value.startsWith('/')) return null
        return runCatching { serviceDiscoveryManager.resolveApiUrl(value) }.getOrNull()
    }

    suspend fun refreshBootstrapConfig() = bootstrapMutex.withLock {
        val attemptGeneration = synchronized(runtimeStateLock) {
            check(!localMode) { "本地模式禁止刷新在线配置" }
            runtimeGeneration
        }
        val discoverySnapshot = refreshServiceDiscovery()
        val bootstrapPath = discoverySnapshot.document.desktop.bootstrapPath.trimStart('/')
        val response = systemCall("配置下发失败") {
            systemApiService.getBootstrapConfig(bootstrapPath)
        }
        if (BuildConfig.DEBUG) {
            runCatching {
                Log.d("ConfigManager", "获取到启动 bootstrap 配置:\n$response")
            }
        }
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "配置下发失败" })
        }
        val endpoints = response.data.endpoints.toRuntimeEndpoints()
        val gatewaySign = RuntimeGatewaySign(
            secret = response.data.gatewaySign.secret.ifBlank { DEFAULT_GATEWAY_SIGN.secret },
            asValue = response.data.gatewaySign.`as`.ifBlank { DEFAULT_GATEWAY_SIGN.asValue },
        )
        var generationAccepted = false
        val discoveryAccepted = serviceDiscoveryManager.publishIfCurrent(discoverySnapshot) {
            synchronized(runtimeStateLock) {
                if (!localMode && runtimeGeneration == attemptGeneration) {
                    runtimeBootstrapState.set(
                        RuntimeBootstrapState(
                            endpoints = endpoints,
                            gatewaySign = gatewaySign,
                            gatewayEndpointPrefixes = endpoints.asUrlList()
                                .map(String::trim)
                                .filter(String::isNotEmpty)
                                .toSet(),
                        ),
                    )
                    generationAccepted = true
                }
            }
        }
        check(discoveryAccepted && generationAccepted) { "启动状态已更新，拒绝应用过期配置" }
    }

    suspend fun getUpdateInfo(): UpdateInfo {
        val response = systemCall("更新信息获取失败") { systemApiService.getCheckUpdate() }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "更新信息获取失败" })
        return response.data
    }

    suspend fun getAgreementInfo(): AgreementInfo {
        val response = systemCall("用户协议获取失败") { systemApiService.getAgreement() }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "用户协议获取失败" })
        return response.data
    }

    suspend fun getServiceAgreementInfo(): AgreementInfo {
        val response = systemCall("服务协议获取失败") { systemApiService.getServiceAgreement() }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "服务协议获取失败" })
        return response.data
    }

    suspend fun getPrivacyPolicyInfo(): AgreementInfo {
        val response = systemCall("隐私政策获取失败") { systemApiService.getPrivacyPolicy() }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "隐私政策获取失败" })
        return response.data
    }

    suspend fun getAboutInfo(): AboutInfo {
        val response = systemCall("关于信息获取失败") { systemApiService.getAbout() }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "关于信息获取失败" })
        return response.data
    }

    suspend fun getDynamicConfigInfo(id: String): DynamicConfigInfo {
        val response = systemCall("动态配置获取失败") { systemApiService.getDynamicConfig(id) }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "动态配置获取失败" })
        return response.data
    }

    suspend fun reportDevice(body: DeviceReportRequest): DeviceReportResult {
        val response = systemCall("设备信息上报失败") { systemApiService.reportDevice(body) }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "设备信息上报失败" })
        return response.data
    }

    suspend fun sendAccountEmailCode(email: String, purpose: String) {
        val response = systemCall("验证码发送失败") {
            systemApiService.sendAccountEmailCode(AccountEmailCodeRequest(email, purpose))
        }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "验证码发送失败" })
    }

    suspend fun registerAccount(email: String, username: String, password: String, code: String): AccountAuthResult {
        val response = systemCall("注册失败") {
            systemApiService.registerAccount(AccountRegisterRequest(email, username, password, code))
        }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "注册失败" })
        return response.data
    }

    suspend fun loginAccountByPassword(identifier: String, password: String): AccountAuthResult {
        val response = systemCall("登录失败") {
            systemApiService.loginAccountByPassword(AccountPasswordLoginRequest(identifier, password))
        }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "登录失败" })
        return response.data
    }

    suspend fun loginAccountByCode(email: String, code: String): AccountAuthResult {
        val response = systemCall("登录失败") {
            systemApiService.loginAccountByCode(AccountCodeLoginRequest(email, code))
        }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "登录失败" })
        return response.data
    }

    suspend fun resetAccountPassword(email: String, code: String, password: String) {
        val response = systemCall("密码重置失败") {
            systemApiService.resetAccountPassword(AccountPasswordResetRequest(email, code, password))
        }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "密码重置失败" })
    }

    suspend fun refreshAccountToken(token: String): AccountAuthResult {
        val response = systemCall("刷新登录失败") {
            systemApiService.refreshAccountToken("Bearer $token")
        }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "刷新登录失败" })
        return response.data
    }

    suspend fun getAccountMe(token: String): AccountUser {
        val response = systemCall("账号信息获取失败") { systemApiService.getAccountMe("Bearer $token") }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "账号信息获取失败" })
        return response.data
    }

    suspend fun requestAccountAvatarUploadToken(
        token: String,
        fileName: String,
        fileSize: Long,
        mimeType: String?,
    ): AccountAvatarUploadToken {
        val response = systemCall("头像上传凭证获取失败") {
            systemApiService.getAccountAvatarUploadToken(
                authorization = "Bearer $token",
                body = AccountAvatarUploadTokenRequest(
                    fileName = fileName,
                    fileSize = fileSize,
                    mimeType = mimeType,
                ),
            )
        }
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "头像上传凭证获取失败" })
        }
        return response.data
    }

    suspend fun sendAccountProfileEmailCode(token: String, email: String) {
        val response = systemCall("验证码发送失败") {
            systemApiService.sendAccountProfileEmailCode(
                authorization = "Bearer $token",
                body = AccountProfileEmailCodeRequest(email),
            )
        }
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
        val response = systemCall("资料更新失败") {
            systemApiService.updateAccountProfile(
                authorization = "Bearer $token",
                body = AccountProfileUpdateRequest(
                    username = username,
                    email = email,
                    code = code,
                    avatarKey = avatarKey,
                ),
            )
        }
        if (!response.success || response.code != 0) {
            throw ApiException(response.code, response.msg.ifBlank { "资料更新失败" })
        }
        return response.data
    }

    suspend fun getSyncChanges(token: String, deviceId: String, since: Long): SyncChangesResult {
        val response = systemCall("拉取同步变更失败") {
            systemApiService.getSyncChanges("Bearer $token", deviceId, since)
        }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "拉取同步变更失败" })
        return response.data
    }

    suspend fun pushSyncChanges(token: String, deviceId: String, changes: List<SyncChangeInput>): SyncPushResult {
        val response = systemCall("推送同步变更失败") {
            systemApiService.pushSyncChanges("Bearer $token", deviceId, SyncPushRequest(changes))
        }
        if (!response.success || response.code != 0) throw ApiException(response.code, response.msg.ifBlank { "推送同步变更失败" })
        return response.data
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

    private fun runtimeTarget(
        urlSelector: (RuntimeEndpoints) -> String,
    ): RuntimeUrlTarget {
        val state = captureRuntimeState()
        return RuntimeUrlTarget(urlSelector(state.endpoints), state)
    }

    private fun runtimePathTarget(
        baseSelector: (RuntimeEndpoints) -> String,
        path: String,
    ): RuntimeUrlTarget {
        require(path.isNotBlank() && !path.startsWith("//") && '\\' !in path) {
            "非法运行时相对路径: $path"
        }
        val state = captureRuntimeState()
        val base = normalizeBaseUrl(baseSelector(state.endpoints))
        val url = "$base${path.trimStart('/')}"
        return RuntimeUrlTarget(url, state)
    }

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
        private const val UNAVAILABLE_MUSIC_BASE = "https://music-runtime.invalid/"

        internal fun createUnavailableEndpoints(): RuntimeEndpoints {
            return RuntimeEndpoints(
                kgBaseUrl = UNAVAILABLE_MUSIC_BASE,
                wyBaseUrl = UNAVAILABLE_MUSIC_BASE,
                proxyBaseUrl = UNAVAILABLE_MUSIC_BASE,
                kwBaseUrl = UNAVAILABLE_MUSIC_BASE,
                kgSongUrl = UNAVAILABLE_MUSIC_BASE,
                wySongUrl = UNAVAILABLE_MUSIC_BASE,
                wySongUrlV1 = UNAVAILABLE_MUSIC_BASE,
            )
        }

        private fun createUnavailableState(): RuntimeBootstrapState = RuntimeBootstrapState(
            endpoints = createUnavailableEndpoints(),
            gatewaySign = DEFAULT_GATEWAY_SIGN,
            gatewayEndpointPrefixes = emptySet(),
        )

        private val DEFAULT_GATEWAY_SIGN = RuntimeGatewaySign(
            secret = "partialypartialypartialypartialy",
            asValue = "yixivip",
        )
    }
}
