package cn.partialy.pm.fault

import cn.partialy.pm.model.SongInfo
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackFaultRecorder @Inject constructor(
    private val store: PlaybackFaultStore,
) {
    fun recordResolutionFailure(
        song: SongInfo,
        quality: String,
        resolvedUrl: String,
        trace: PlaybackRequestTrace?,
        fallbackMethodName: String,
        error: Throwable? = null,
    ) {
        val failureType = when {
            trace?.errorType?.isNotBlank() == true || error != null -> "network_exception"
            trace?.responseCode != null && trace.responseCode !in 200..299 -> "http_failure"
            resolvedUrl.isBlank() -> "empty_url"
            else -> "invalid_url"
        }
        store.insert(
            buildLog(
                song = song,
                quality = quality,
                failureType = failureType,
                trace = trace,
                methodName = fallbackMethodName,
                resolvedUrl = resolvedUrl,
                error = error,
                fallbackMessage = when (failureType) {
                    "empty_url" -> "播放地址为空"
                    "invalid_url" -> "播放地址无效"
                    "http_failure" -> "播放地址请求失败"
                    else -> "播放地址请求异常"
                },
            ),
        )
    }

    fun recordPlayerFailure(
        song: SongInfo,
        resolvedUrl: String,
        quality: String,
        trace: PlaybackRequestTrace?,
        error: Throwable,
        diagnosticSummary: String = "",
    ) {
        val diagnosticError = if (diagnosticSummary.isBlank()) {
            error
        } else {
            PlaybackDiagnosticException(diagnosticSummary, error)
        }
        store.insert(
            buildLog(
                song = song,
                quality = quality,
                failureType = "playback_failure",
                trace = trace,
                methodName = "PlayerEngine.onPlayerError",
                resolvedUrl = PlaybackFaultSanitizer.limit(resolvedUrl, PlaybackFaultSanitizer.MAX_URL_LENGTH),
                error = diagnosticError,
                fallbackMessage = "播放器加载失败",
            ),
        )
    }

    private fun buildLog(
        song: SongInfo,
        quality: String,
        failureType: String,
        trace: PlaybackRequestTrace?,
        methodName: String,
        resolvedUrl: String,
        error: Throwable?,
        fallbackMessage: String,
    ) = PlaybackFaultLog(
        id = UUID.randomUUID().toString(),
        scene = SCENE_PLAY_URL,
        failureType = failureType,
        occurredAt = System.currentTimeMillis(),
        methodName = trace?.methodName?.ifBlank { methodName } ?: methodName,
        requestMethod = trace?.requestMethod.orEmpty(),
        requestUrl = trace?.requestUrl.orEmpty(),
        requestParamsJson = trace?.requestParamsJson.orEmpty().ifBlank { "{}" },
        nonceId = trace?.nonceId.orEmpty(),
        responseCode = trace?.responseCode,
        responseBody = trace?.responseBody.orEmpty(),
        resolvedUrl = PlaybackFaultSanitizer.limit(resolvedUrl, PlaybackFaultSanitizer.MAX_URL_LENGTH),
        errorType = error?.javaClass?.name ?: trace?.errorType.orEmpty(),
        errorMessage = PlaybackFaultSanitizer.errorMessage(error?.message ?: trace?.errorMessage ?: fallbackMessage),
        stackTrace = if (error != null) PlaybackFaultSanitizer.stackTrace(error) else trace?.stackTrace.orEmpty(),
        songSource = song.type.name,
        songId = PlaybackFaultSanitizer.limit(song.id, 256),
        quality = PlaybackFaultSanitizer.limit(quality, 64),
    )

    private class PlaybackDiagnosticException(
        message: String,
        cause: Throwable,
    ) : RuntimeException(message, cause)

    companion object {
        const val SCENE_PLAY_URL = "play_url"
    }
}
