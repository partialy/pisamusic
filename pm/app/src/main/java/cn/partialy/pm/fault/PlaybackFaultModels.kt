package cn.partialy.pm.fault

data class PlaybackDiagnosticRequest(
    val traceId: String,
    val methodName: String,
)

data class PlaybackRequestTrace(
    val traceId: String,
    val methodName: String,
    val requestMethod: String,
    val requestUrl: String,
    val requestParamsJson: String,
    val nonceId: String,
    val responseCode: Int?,
    val responseBody: String,
    val errorType: String,
    val errorMessage: String,
    val stackTrace: String,
)

data class ResolvedPlayUrl(
    val url: String,
    val trace: PlaybackRequestTrace? = null,
)

data class PlaybackFaultLog(
    val id: String,
    val scene: String,
    val failureType: String,
    val occurredAt: Long,
    val methodName: String,
    val requestMethod: String,
    val requestUrl: String,
    val requestParamsJson: String,
    val nonceId: String,
    val responseCode: Int?,
    val responseBody: String,
    val resolvedUrl: String,
    val errorType: String,
    val errorMessage: String,
    val stackTrace: String,
    val songSource: String,
    val songId: String,
    val quality: String,
    val isUpload: Boolean = false,
    val uploadedAt: Long? = null,
)

data class PlaybackFaultStats(
    val totalCount: Int,
    val recentSevenDaysCount: Int,
    val pendingCount: Int,
    val latestOccurredAt: Long?,
    val lastReportedAt: Long?,
)

data class FaultReportEnvironment(
    val appVersion: String,
    val appVersionCode: Long,
    val osVersion: String,
    val sdkInt: Int,
    val brand: String,
    val model: String,
    val networkType: String,
)

data class FaultReportLogPayload(
    val clientLogId: String,
    val occurredAt: Long,
    val scene: String,
    val failureType: String,
    val methodName: String,
    val requestMethod: String,
    val requestUrl: String,
    val requestParamsJson: String,
    val nonceId: String,
    val responseCode: Int?,
    val responseBody: String,
    val resolvedUrl: String,
    val errorType: String,
    val errorMessage: String,
    val stackTrace: String,
    val songSource: String,
    val songId: String,
    val quality: String,
)

data class FaultReportRequest(
    val reportId: String,
    val scene: String = PlaybackFaultRecorder.SCENE_PLAY_URL,
    val environment: FaultReportEnvironment,
    val logs: List<FaultReportLogPayload>,
)

data class FaultReportSubmitData(
    val reportId: String?,
    val acceptedCount: Int,
    val duplicateCount: Int,
    val receivedCount: Int,
    val createdAt: Long,
)

data class FaultReportSubmitResponse(
    val success: Boolean = false,
    val msg: String? = null,
    val data: FaultReportSubmitData? = null,
)

fun PlaybackFaultLog.toPayload() = FaultReportLogPayload(
    clientLogId = id,
    occurredAt = occurredAt,
    scene = scene,
    failureType = failureType,
    methodName = methodName,
    requestMethod = requestMethod,
    requestUrl = requestUrl,
    requestParamsJson = requestParamsJson,
    nonceId = nonceId,
    responseCode = responseCode,
    responseBody = responseBody,
    resolvedUrl = resolvedUrl,
    errorType = errorType,
    errorMessage = errorMessage,
    stackTrace = stackTrace,
    songSource = songSource,
    songId = songId,
    quality = quality,
)
