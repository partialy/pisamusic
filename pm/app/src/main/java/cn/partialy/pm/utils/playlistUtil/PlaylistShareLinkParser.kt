package cn.partialy.pm.utils.playlistUtil

import java.net.URI
import java.net.URLDecoder

sealed interface PlaylistShareLinkResult {
    data class Netease(val playlistId: String) : PlaylistShareLinkResult
    data class Kugou(val playlistId: String) : PlaylistShareLinkResult
    object Invalid : PlaylistShareLinkResult
}

/** 只解析明确的公开链接，不发起短链接跳转或网页请求。 */
object PlaylistShareLinkParser {
    private val urls = Regex("https?://[^\\s<>\"“”《》]+", RegexOption.IGNORE_CASE)
    private val trailingPunctuation = "。，、；;！!？?）)]}」』.,”"
    private val kugouPath = Regex("/songlist/gcid_([0-9a-y]+)z([0-9a-y]+)z([0-9a-y]+)z([0-9a-y]{3})/?")

    fun parse(text: String): PlaylistShareLinkResult {
        val normalized = text.replace("\\:", ":").replace("\\/", "/").replace("&amp;", "&")
        for (match in urls.findAll(normalized)) {
            val uri = runCatching { URI(match.value.trimEnd { it in trailingPunctuation }) }.getOrNull() ?: continue
            val host = uri.host ?: continue
            if (uri.userInfo != null) continue
            if (host.lowercase() in setOf("kugou.com", "www.kugou.com", "m.kugou.com")) {
                parseKugouId(uri)?.let { return PlaylistShareLinkResult.Kugou(it) }
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
        return PlaylistShareLinkResult.Invalid
    }

    private fun parseKugouId(uri: URI): String? {
        val parts = kugouPath.matchEntire(uri.path.orEmpty())?.groupValues ?: return null
        // gcid 用 z 分隔 35 进制字段；尾段首位是末字段，其余两位不用于构建 collection ID。
        // 这里只还原候选身份，必须再由歌单详情接口确认，不能把 src_cid 原歌单替代分享副本。
        val type = parts[1].toLongOrNull(35)?.takeIf { it > 0 } ?: return null
        val owner = parts[2].toLongOrNull(35)?.takeIf { it > 0 } ?: return null
        val list = parts[3].toLongOrNull(35)?.takeIf { it > 0 } ?: return null
        val suffix = parts[4].take(1).toLongOrNull(35) ?: return null
        return "collection_${type}_${owner}_${list}_${suffix}"
    }

    private fun decode(value: String): String? = runCatching { URLDecoder.decode(value, "UTF-8") }.getOrNull()
}
