package cn.partialy.pm.utils.playlistUtil

import java.net.URI
import java.net.URLDecoder

sealed interface PlaylistShareLinkResult {
    data class Netease(val playlistId: String) : PlaylistShareLinkResult
    object UnsupportedKugou : PlaylistShareLinkResult
    object Invalid : PlaylistShareLinkResult
}

/** 只解析明确的公开链接，不发起短链接跳转或网页请求。 */
object PlaylistShareLinkParser {
    private val urls = Regex("https?://[^\\s<>\"“”《》]+", RegexOption.IGNORE_CASE)
    private val trailingPunctuation = "。，、；;！!？?）)]}」』.,”"

    fun parse(text: String): PlaylistShareLinkResult {
        val normalized = text.replace("\\:", ":").replace("\\/", "/").replace("&amp;", "&")
        var hasKugou = false
        for (match in urls.findAll(normalized)) {
            val uri = runCatching { URI(match.value.trimEnd { it in trailingPunctuation }) }.getOrNull() ?: continue
            val host = uri.host ?: continue
            if (host.equals("kugou.com", true) || host.endsWith(".kugou.com", true)) {
                hasKugou = true
                continue
            }
            if (!host.equals("music.163.com", true) || uri.userInfo != null) continue
            val playlistUri = if ((uri.path.isNullOrEmpty() || uri.path == "/") && uri.rawFragment != null) {
                runCatching { URI(uri.rawFragment) }.getOrNull() ?: continue
            } else uri
            if (playlistUri.path?.trimEnd('/') !in setOf("/playlist", "/m/playlist")) continue
            val id = playlistUri.rawQuery?.split('&')?.firstNotNullOfOrNull { parameter ->
                val pair = parameter.split('=', limit = 2)
                if (pair.size != 2 || decode(pair[0]) != "id") null else decode(pair[1])
            } ?: continue
            if (!id.matches(Regex("[0-9]+"))) continue
            val numericId = id.toLongOrNull()?.takeIf { it > 0 } ?: continue
            return PlaylistShareLinkResult.Netease(numericId.toString())
        }
        return if (hasKugou) PlaylistShareLinkResult.UnsupportedKugou else PlaylistShareLinkResult.Invalid
    }

    private fun decode(value: String): String? = runCatching { URLDecoder.decode(value, "UTF-8") }.getOrNull()
}
