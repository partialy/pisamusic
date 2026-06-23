package cn.partialy.pm.fault

import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import okhttp3.Interceptor
import okhttp3.Response

@Singleton
class PlaybackTraceInterceptor @Inject constructor(
    private val registry: PlaybackTraceRegistry,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val traceId = original.header(HEADER_TRACE_ID).orEmpty()
        if (traceId.isBlank()) return chain.proceed(original)
        val methodName = original.header(HEADER_METHOD_NAME).orEmpty()
        val request = original.newBuilder()
            .removeHeader(HEADER_TRACE_ID)
            .removeHeader(HEADER_METHOD_NAME)
            .build()
        return try {
            val response = chain.proceed(request)
            registry.put(
                PlaybackRequestTrace(
                    traceId = traceId,
                    methodName = methodName,
                    requestMethod = request.method,
                    requestUrl = PlaybackFaultSanitizer.sanitizeUrl(request.url),
                    requestParamsJson = PlaybackFaultSanitizer.paramsJson(request.url),
                    nonceId = request.header("n").orEmpty(),
                    responseCode = response.code,
                    responseBody = PlaybackFaultSanitizer.sanitizeResponse(
                        response.peekBody(PlaybackFaultSanitizer.MAX_RESPONSE_LENGTH.toLong() * 4).string(),
                    ),
                    errorType = "",
                    errorMessage = "",
                    stackTrace = "",
                ),
            )
            response
        } catch (error: Exception) {
            registry.put(
                PlaybackRequestTrace(
                    traceId = traceId,
                    methodName = methodName,
                    requestMethod = request.method,
                    requestUrl = PlaybackFaultSanitizer.sanitizeUrl(request.url),
                    requestParamsJson = PlaybackFaultSanitizer.paramsJson(request.url),
                    nonceId = request.header("n").orEmpty(),
                    responseCode = null,
                    responseBody = "",
                    errorType = error.javaClass.name,
                    errorMessage = PlaybackFaultSanitizer.errorMessage(error.message),
                    stackTrace = PlaybackFaultSanitizer.stackTrace(error),
                ),
            )
            throw error
        }
    }

    companion object {
        const val HEADER_TRACE_ID = "X-PM-Playback-Trace-Id"
        const val HEADER_METHOD_NAME = "X-PM-Playback-Method"

        fun request(methodName: String) = PlaybackDiagnosticRequest(
            traceId = UUID.randomUUID().toString(),
            methodName = methodName,
        )
    }
}
