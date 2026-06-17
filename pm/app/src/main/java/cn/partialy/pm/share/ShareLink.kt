package cn.partialy.pm.share

import android.net.Uri

object ShareLink {
    private const val SHARE_TYPE = "music-share"
    private const val WEB_ORIGIN = "https://pisamusic.partialy.cn"
    private val UUID_PATTERN = Regex("^[0-9a-fA-F-]{32,40}$")

    data class OpenShare(val uuid: String)

    fun buildWebLink(uuid: String): String =
        "$WEB_ORIGIN/scan?type=$SHARE_TYPE&uuid=${Uri.encode(uuid)}"

    fun buildAppLink(uuid: String): String =
        "pisamusic://scan?type=$SHARE_TYPE&uuid=${Uri.encode(uuid)}"

    fun parse(raw: String?): OpenShare? {
        val text = raw?.trim().orEmpty()
        if (text.isBlank()) return null
        val uri = runCatching { Uri.parse(text) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase().orEmpty()
        val host = uri.host?.lowercase().orEmpty()
        val path = uri.path.orEmpty().trimEnd('/')
        val isWebScan = scheme in setOf("http", "https") &&
            host == "pisamusic.partialy.cn" &&
            path == "/scan"
        val isAppScan = scheme == "pisamusic" && host == "scan"
        if (!isWebScan && !isAppScan) return null
        if (uri.getQueryParameter("type") != SHARE_TYPE) return null
        val uuid = uri.getQueryParameter("uuid")?.trim().orEmpty()
        return uuid.takeIf { UUID_PATTERN.matches(it) }?.let(::OpenShare)
    }
}
