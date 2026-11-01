package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongType
import java.net.URI

/** 仅为详情大封面生成请求候选；不改写用于收藏和分享的原始地址。 */
fun toHeroCoverCandidates(source: SongType?, originalUrl: String): List<String> {
    if (originalUrl.isBlank()) return emptyList()
    val original = originalUrl.trim()
    val uri = runCatching { URI(original.replace("{size}", "500")) }.getOrNull()
        ?: return listOf(original)
    if (uri.scheme !in listOf("http", "https") || uri.host == null) return listOf(original)
    val host = uri.host.lowercase()
    val kgHost = host == "kgimg.com" || host.endsWith(".kgimg.com") ||
        host == "kugou.com" || host.endsWith(".kugou.com")
    val wyHost = host == "music.126.net" || host.endsWith(".music.126.net")
    val upgraded = when {
        (source == SongType.KG || kgHost) && "{size}" in original ->
            original.replace("{size}", "500")
        wyHost -> original.replace(Regex("([?&]param=)\\d+y\\d+(?=&|#|$)")) {
            "${it.groupValues[1]}500y500"
        }
        else -> original
    }
    // KG 模板本身不是可请求的 URL，原尺寸候选使用详情改造前的 240。
    val fallback = if ("{size}" in original && (source == SongType.KG || kgHost)) {
        original.replace("{size}", "240")
    } else original
    return listOf(upgraded, fallback).distinct()
}

/** 持久化和远程请求仅接受可解析的 HTTP(S) 地址；保留 Hero 原有兼容返回值。 */
fun requestablePlaylistCoverCandidates(source: SongType?, originalUrl: String): List<String> =
    toHeroCoverCandidates(source, originalUrl).filter { value ->
        runCatching {
            val uri = URI(value)
            uri.scheme in listOf("http", "https") && !uri.host.isNullOrBlank() &&
                uri.rawUserInfo == null && "{size}" !in value
        }.getOrDefault(false)
    }
