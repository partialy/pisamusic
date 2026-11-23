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
import retrofit2.HttpException

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
        val environment = FaultReportEnvironmentCollector.collect(context)

        var lastReportId: String? = null
        var acceptedCount = 0
        var duplicateCount = 0
        var receivedCount = 0
        var latestCreatedAt = 0L

        for ((scene, batch) in logs.groupBy { it.scene.ifBlank { PlaybackFaultRecorder.SCENE_PLAY_URL } }) {
            val result = submitSceneBatchWithCompat(
                scene = scene,
                batch = batch,
                authorization = authorization,
                environment = environment,
            )
            val uploadedAt = System.currentTimeMillis()
            withContext(Dispatchers.IO) { store.markUploaded(batch.map { it.id }, uploadedAt) }
            lastReportId = result.reportId ?: lastReportId
            acceptedCount += result.acceptedCount
            duplicateCount += result.duplicateCount
            receivedCount += result.receivedCount
            latestCreatedAt = maxOf(latestCreatedAt, result.createdAt)
        }

        return FaultReportSubmitData(
            reportId = lastReportId,
            acceptedCount = acceptedCount,
            duplicateCount = duplicateCount,
            receivedCount = receivedCount,
            createdAt = latestCreatedAt,
        )
    }

    private suspend fun submitSceneBatchWithCompat(
        scene: String,
        batch: List<PlaybackFaultLog>,
        authorization: String?,
        environment: FaultReportEnvironment,
    ): FaultReportSubmitData {
        return try {
            submitSceneBatch(scene, batch, authorization, environment)
        } catch (error: SceneRejectedException) {
            if (scene != PlaybackFaultRecorder.SCENE_APP_CRASH) throw error
            // 兼容尚未支持 app_crash 场景的旧服务端：保留 failureType/堆栈，按 play_url 场景降级重发。
            submitSceneBatch(PlaybackFaultRecorder.SCENE_PLAY_URL, batch, authorization, environment)
        }
    }

    private suspend fun submitSceneBatch(
        scene: String,
        batch: List<PlaybackFaultLog>,
        authorization: String?,
        environment: FaultReportEnvironment,
    ): FaultReportSubmitData {
        val payloads = batch.map { it.toPayload().copy(scene = scene) }
        val response = try {
            systemApiService.submitFaultReport(
                authorization = authorization,
                body = FaultReportRequest(
                    reportId = UUID.randomUUID().toString(),
                    scene = scene,
                    environment = environment,
                    logs = payloads,
                ),
            )
        } catch (httpError: HttpException) {
            val errorBody = runCatching { httpError.response()?.errorBody()?.string().orEmpty() }.getOrDefault("")
            if (httpError.code() == 400 && errorBody.contains("scene", ignoreCase = true)) {
                throw SceneRejectedException(errorBody.ifBlank { "scene无效" })
            }
            throw httpError
        }
        if (!response.success || response.data == null) {
            val msg = response.msg?.takeIf { it.isNotBlank() } ?: "故障信息上报失败"
            if (msg.contains("scene", ignoreCase = true)) {
                throw SceneRejectedException(msg)
            }
            error(msg)
        }
        return response.data
    }

    private class SceneRejectedException(message: String) : IllegalStateException(message)
}
