package cn.partialy.pm.fault

import android.content.Context
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.auth.AccountSessionStore
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class FaultReportRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val store: PlaybackFaultStore,
    private val systemApiService: SystemApiService,
) {
    suspend fun loadStats(): PlaybackFaultStats = withContext(Dispatchers.IO) { store.stats() }

    suspend fun submitPending(): FaultReportSubmitData {
        val logs = withContext(Dispatchers.IO) { store.pendingLogs() }
        require(logs.isNotEmpty()) { "暂无待上报的故障信息" }
        val session = AccountSessionStore.read(context)
        val authorization = session.token.takeIf { session.loggedIn }?.let { "Bearer $it" }
        val response = systemApiService.submitFaultReport(
            authorization = authorization,
            body = FaultReportRequest(
                reportId = UUID.randomUUID().toString(),
                environment = FaultReportEnvironmentCollector.collect(context),
                logs = logs.map(PlaybackFaultLog::toPayload),
            ),
        )
        if (!response.success || response.data == null) {
            error(response.msg?.takeIf { it.isNotBlank() } ?: "故障信息上报失败")
        }
        val uploadedAt = System.currentTimeMillis()
        withContext(Dispatchers.IO) { store.markUploaded(logs.map { it.id }, uploadedAt) }
        return response.data
    }
}
