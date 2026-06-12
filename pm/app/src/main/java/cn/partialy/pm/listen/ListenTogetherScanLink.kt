package cn.partialy.pm.listen

import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object ListenTogetherScanLink {
    const val ACTION_JOIN_ROOM = "listen-together-join"
    private const val WEB_SCHEME = "https"
    private const val WEB_HOST = "pisamusic.partialy.cn"
    private const val APP_SCHEME = "pisamusic"
    private const val SCAN_HOST = "scan"

    sealed interface Action {
        data class JoinRoom(val roomId: String) : Action
    }

    fun buildWebLink(roomId: String): String =
        "https://$WEB_HOST/scan?type=$ACTION_JOIN_ROOM&roomId=${encode(roomId)}"

    fun buildAppLink(roomId: String): String =
        "$APP_SCHEME://$SCAN_HOST?type=$ACTION_JOIN_ROOM&roomId=${encode(roomId)}"

    fun parse(raw: String?): Action? {
        val uri = runCatching { URI(raw?.trim().orEmpty()) }.getOrNull() ?: return null
        if (!isSupportedEndpoint(uri)) return null
        val params = parseQuery(uri.rawQuery ?: return null) ?: return null
        if (params["type"] != ACTION_JOIN_ROOM) return null
        val roomId = params["roomId"].orEmpty()
        return roomId.takeIf { it.matches(Regex("\\d{4,8}")) }?.let(Action::JoinRoom)
    }

    private fun isSupportedEndpoint(uri: URI): Boolean {
        return when {
            uri.scheme.equals(WEB_SCHEME, ignoreCase = true) -> {
                uri.host.equals(WEB_HOST, ignoreCase = true) &&
                    uri.port in listOf(-1, 443) &&
                    uri.path in setOf("/scan", "/scan/")
            }
            uri.scheme.equals(APP_SCHEME, ignoreCase = true) -> {
                uri.host.equals(SCAN_HOST, ignoreCase = true) &&
                    (uri.path.isNullOrEmpty() || uri.path == "/")
            }
            else -> false
        }
    }

    private fun parseQuery(rawQuery: String): Map<String, String>? {
        if (rawQuery.isBlank()) return emptyMap()
        return runCatching {
            rawQuery.split("&").associate { part ->
                val separator = part.indexOf('=')
                val rawKey = if (separator >= 0) part.substring(0, separator) else part
                val rawValue = if (separator >= 0) part.substring(separator + 1) else ""
                decode(rawKey) to decode(rawValue)
            }
        }.getOrNull()
    }

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8.name())

    private fun decode(value: String): String =
        URLDecoder.decode(value, StandardCharsets.UTF_8.name())
}
