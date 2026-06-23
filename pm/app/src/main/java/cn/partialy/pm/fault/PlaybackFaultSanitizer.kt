package cn.partialy.pm.fault

import okhttp3.HttpUrl
import org.json.JSONArray
import org.json.JSONObject

object PlaybackFaultSanitizer {
    const val MAX_URL_LENGTH = 2048
    const val MAX_PARAMS_LENGTH = 4096
    const val MAX_RESPONSE_LENGTH = 4096
    const val MAX_ERROR_LENGTH = 2048
    const val MAX_STACK_LENGTH = 4096

    private val sensitiveKeys = setOf(
        "authorization", "cookie", "set-cookie", "token", "access_token", "refresh_token",
        "signature", "sign", "secret", "password", "s", "x-pm-random",
    )

    fun sanitizeUrl(url: HttpUrl): String {
        val builder = url.newBuilder()
        for (name in url.queryParameterNames) {
            if (name.lowercase() in sensitiveKeys) builder.setQueryParameter(name, "[REDACTED]")
        }
        return limit(builder.build().toString(), MAX_URL_LENGTH)
    }

    fun paramsJson(url: HttpUrl): String {
        val json = JSONObject()
        for (name in url.queryParameterNames) {
            val values = url.queryParameterValues(name)
            val safe: Any = if (name.lowercase() in sensitiveKeys) {
                "[REDACTED]"
            } else if (values.size == 1) {
                values.firstOrNull().orEmpty()
            } else {
                JSONArray(values)
            }
            json.put(name, safe)
        }
        return limit(json.toString(), MAX_PARAMS_LENGTH)
    }

    fun sanitizeResponse(raw: String): String {
        if (raw.isBlank()) return ""
        val sanitized = runCatching {
            when {
                raw.trimStart().startsWith("{") -> sanitizeObject(JSONObject(raw)).toString()
                raw.trimStart().startsWith("[") -> sanitizeArray(JSONArray(raw)).toString()
                else -> raw
            }
        }.getOrDefault(raw)
        return limit(sanitized, MAX_RESPONSE_LENGTH)
    }

    fun errorMessage(raw: String?): String = limit(raw.orEmpty(), MAX_ERROR_LENGTH)

    fun stackTrace(error: Throwable?): String = limit(error?.stackTraceToString().orEmpty(), MAX_STACK_LENGTH)

    fun limit(value: String, maxLength: Int): String = if (value.length <= maxLength) value else value.take(maxLength)

    private fun sanitizeObject(input: JSONObject): JSONObject {
        val output = JSONObject()
        val keys = input.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = input.opt(key)
            output.put(key, if (key.lowercase() in sensitiveKeys) "[REDACTED]" else sanitizeValue(value))
        }
        return output
    }

    private fun sanitizeArray(input: JSONArray): JSONArray {
        val output = JSONArray()
        for (index in 0 until input.length()) output.put(sanitizeValue(input.opt(index)))
        return output
    }

    private fun sanitizeValue(value: Any?): Any? = when (value) {
        is JSONObject -> sanitizeObject(value)
        is JSONArray -> sanitizeArray(value)
        else -> value
    }
}
