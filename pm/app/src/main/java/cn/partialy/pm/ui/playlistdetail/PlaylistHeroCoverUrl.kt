package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongType
import java.net.URI

/** 仅为详情大封面生成请求候选；不改写用于收藏和分享的原始地址。 */
fun toHeroCoverCandidates(source: SongType?, originalUrl: String): List<String> {
    if (originalUrl.isBlank()) return emptyList()
    val original = originalUrl.trim()
    val uri = runCatching { URI(original.replace("{size}", "1024")) }.getOrNull()
        ?: return listOf(original)
    if (uri.scheme !in listOf("http", "https") || uri.host == null) return listOf(original)
    val host = uri.host.lowercase()
    val kgHost = host == "kgimg.com" || host.endsWith(".kgimg.com") ||
        host == "kugou.com" || host.endsWith(".kugou.com")
    val wyHost = host == "music.126.net" || host.endsWith(".music.126.net")
    val sizes = listOf(1024, 720, 480, 240)
    val candidates = when {
        (source == SongType.KG || kgHost) && "{size}" in original -> sizes.map { original.replace("{size}", it.toString()) }
        kgHost -> sizes.map { cn.partialy.pm.utils.SongCoverUrl.getKgImageUrl(original, it) }
        wyHost -> sizes.map { wyDetailCover(original, uri, it) }
        else -> listOf(original)
    }
    return (candidates + original.takeUnless { "{size}" in it }.orEmpty()).filter(String::isNotBlank).distinct()
}

/** 持久化保留原始封面，模板仅在展示时展开；仍要求能够生成合法远程请求地址。 */
fun rawRemotePlaylistCoverOrNull(source: SongType?, originalUrl: String): String? =
    originalUrl.trim().takeIf { requestablePlaylistCoverCandidates(source, it).isNotEmpty() }

/** 远程请求仅接受可解析的 HTTP(S) 地址；保留 Hero 原有兼容返回值。 */
fun requestablePlaylistCoverCandidates(source: SongType?, originalUrl: String): List<String> =
    toHeroCoverCandidates(source, originalUrl).filter { value ->
        runCatching {
            val uri = URI(value)
            uri.scheme in listOf("http", "https") && !uri.host.isNullOrBlank() &&
                uri.rawUserInfo == null && "{size}" !in value
        }.getOrDefault(false)
    }

/** 只改实际 query 的尺寸值，原样保留编码 token、其他参数与 fragment。 */
private fun wyDetailCover(original: String, uri: URI, size: Int): String {
    val query = uri.rawQuery.orEmpty()
    val param = Regex("(^|&)param=\\d+y\\d+(?=&|$)")
    val thumbnail = Regex("(^|&)thumbnail=\\d+y\\d+(?=&|$)")
    val next = when {
        param.containsMatchIn(query) -> query.replace(param) { "${it.groupValues[1]}param=${size}y$size" }
        thumbnail.containsMatchIn(query) -> query.replace(thumbnail) { "${it.groupValues[1]}thumbnail=${size}y$size" }
        "param=" in query || "thumbnail=" in query -> return original
        query.isEmpty() -> "param=${size}y$size"
        else -> "$query&param=${size}y$size"
    }
    return original.substringBefore('?').substringBefore('#') + "?" + next +
        (uri.rawFragment?.let { "#$it" } ?: "")
}
