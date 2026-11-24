package cn.partialy.pm.feedback

import android.content.Context
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.network.discovery.ServiceDiscoveryManager
import cn.partialy.pm.util.DeviceInfoCollector
import cn.partialy.pm.utils.ServerDevicePrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeedbackHistoryRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val systemApiService: SystemApiService,
    private val serviceDiscoveryManager: ServiceDiscoveryManager,
    private val configManager: ConfigManager,
) {
    private val refreshMutex = Mutex()

    fun resolveImageUrl(pathOrUrl: String?): String? {
        val raw = pathOrUrl?.trim().orEmpty()
        if (raw.isEmpty()) return null
        if (raw.startsWith("http://", ignoreCase = true) || raw.startsWith("https://", ignoreCase = true)) {
            return raw
        }
        return serviceDiscoveryManager.resolveApiUrl(raw)
    }

    suspend fun fetchHistory(offset: Int, limit: Int): FeedbackHistoryPageDto = withContext(Dispatchers.IO) {
        ensureDeviceTokenIfNeeded()
        val response = try {
            requestHistory(offset, limit)
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            val unauthorized = (error is HttpException && error.code() == 401) ||
                (error is ConfigManager.ApiException && error.code == 401)
            if (!unauthorized) throw error
            refreshMutex.withLock {
                refreshCredentials()
            }
            requestHistory(offset, limit)
        }

        if (!response.success || response.code != 0 || response.data == null) {
            throw ConfigManager.ApiException(
                response.code,
                response.msg.ifBlank { "获取反馈记录失败" },
            )
        }
        response.data
    }

    private suspend fun requestHistory(offset: Int, limit: Int): FeedbackHistoryResponse {
        val session = AccountSessionStore.read(context)
        val authorization = session.token.takeIf { session.loggedIn }?.let { "Bearer $it" }
        val deviceToken = ServerDevicePrefs.getMessageToken(context).ifBlank { null }
        check(authorization != null || deviceToken != null) { "设备身份不可用，请联网后重试" }
        val response = systemApiService.getMyFeedbackHistory(
            authorization = authorization,
            deviceToken = deviceToken,
            offset = offset,
            limit = limit,
        )
        if (response.code == 401) {
            throw ConfigManager.ApiException(401, response.msg)
        }
        return response
    }

    private suspend fun ensureDeviceTokenIfNeeded() {
        if (ServerDevicePrefs.getMessageToken(context).isNotBlank()) return
        refreshMutex.withLock {
            if (ServerDevicePrefs.getMessageToken(context).isNotBlank()) return@withLock
            runCatching { refreshDevice() }
        }
    }

    private suspend fun refreshCredentials() {
        runCatching { refreshDevice() }
        val session = AccountSessionStore.read(context)
        if (session.loggedIn && session.token.isNotBlank()) {
            val refreshed = runCatching { configManager.refreshAccountToken(session.token) }.getOrNull()
            if (refreshed != null && refreshed.user.id == session.user.id) {
                AccountSessionStore.save(context, refreshed)
            }
        }
    }

    private suspend fun refreshDevice() {
        val report = configManager.reportDevice(DeviceInfoCollector.build(context))
        if (!report.locked && report.id.isNotBlank() && report.messageToken.isNotBlank()) {
            ServerDevicePrefs.saveReportIdentity(context, report.id, report.messageToken)
        }
    }
}
