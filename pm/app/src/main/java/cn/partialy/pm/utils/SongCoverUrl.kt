package cn.partialy.pm.utils

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType

object SongCoverUrl {
    const val SIZE_SMALL = 120
    const val SIZE_MEDIUM = 240
    const val SIZE_LARGE = 360
    const val SIZE_XLARGE = 480
    const val SIZE_PLAYER = 720
    const val SIZE_DETAIL = 1024

    fun getKgImageUrl(url: String?, size: Int = SIZE_SMALL, fallback: String = ""): String {
        val raw = url?.trim().orEmpty()
        if (raw.isBlank()) return fallback
        val target = normalizeSize(size).toString()
        val resolved = raw.replace("{size}", target)
        // 历史收藏、同步和播放状态可能已存成缩略图；只改已知 KG CDN 的尺寸段。
        return if (isKgCdn(resolved)) resolved.replace(Regex("^(https?://[^/?#]+/stdmusic/)\\d+(/)", RegexOption.IGNORE_CASE)) {
            "${it.groupValues[1]}$target${it.groupValues[2]}"
        } else resolved
    }

    /** DTO/分享保留原始地址，校验时仅临时展开模板，不把展示尺寸写回数据。 */
    fun getRawRemoteCover(url: String?): String {
        val raw = url?.trim().orEmpty()
        return raw.takeIf {
            runCatching {
                val uri = java.net.URI(raw.replace("{size}", "240"))
                uri.scheme in listOf("http", "https") && !uri.host.isNullOrBlank() && uri.rawUserInfo == null
            }.getOrDefault(false)
        }.orEmpty()
    }

    private fun isKgCdn(url: String): Boolean {
        val host = runCatching { java.net.URI(url.replace("{size}", "240")).host?.lowercase() }.getOrNull().orEmpty()
        return host == "kugou.com" || host.endsWith(".kugou.com") || host == "kgimg.com" || host.endsWith(".kgimg.com")
    }

    fun getSongCover(song: SongInfo, size: Int = SIZE_SMALL, fallback: String = ""): String =
        getSongCover(song.type, song.coverUrl, size, fallback)

    fun getSongCover(type: SongType, coverUrl: String?, size: Int = SIZE_SMALL, fallback: String = ""): String =
        when (type) {
            SongType.LOCAL -> fallback
            SongType.KG -> getKgImageUrl(coverUrl, size, fallback)
            SongType.WY -> getWyCoverSizeUrl(coverUrl, wySizeOf(size), fallback)
            SongType.KW -> coverUrl?.trim().orEmpty().ifBlank { fallback }
            SongType.CLOUD -> coverUrl?.trim().orEmpty().ifBlank { fallback }
        }

    fun getRemoteCover(source: String, coverUrl: String?, size: Int = SIZE_MEDIUM, fallback: String = ""): String {
        val raw = coverUrl?.trim().orEmpty()
        if (raw.isBlank() || (!raw.startsWith("http://") && !raw.startsWith("https://"))) return fallback
        return when (source.trim().lowercase()) {
            "kg" -> getKgImageUrl(raw, size, fallback)
            "wy" -> getWyCoverSizeUrl(raw, wySizeOf(size), fallback)
            "kw" -> raw
            "local" -> fallback
            else -> if (source.isBlank() && isKgCdn(raw)) getKgImageUrl(raw, size, fallback) else raw
        }.ifBlank { fallback }
    }

    fun getSongCoverData(song: SongInfo, size: Int = SIZE_SMALL, fallback: String = ""): Any? =
        song.embeddedCoverArt ?: getSongCover(song, size, fallback).takeIf { it.isNotBlank() }

    /** 播放页取图失败逐级回退，保留原地址；不改写收藏或房间队列中的原始元数据。 */
    fun getPlayerCoverCandidates(song: SongInfo): List<Any> {
        song.embeddedCoverArt?.let { return listOf(it) }
        if (song.type == SongType.LOCAL) return emptyList()
        val original = song.coverUrl.trim()
        if (original.isEmpty()) return emptyList()
        val sized = listOf(SIZE_PLAYER, SIZE_XLARGE, SIZE_MEDIUM).map {
            getSongCover(song, it)
        }
        return (sized + original.replace("{size}", SIZE_MEDIUM.toString()))
            .flatMap { url ->
                // 酷狗旧快照常为固定尺寸 URL，安全限定 CDN 路径后才尝试小图回退。
                val uri = runCatching { java.net.URI(url) }.getOrNull()
                val host = uri?.host.orEmpty().lowercase()
                val kgHost = host == "kugou.com" || host.endsWith(".kugou.com") ||
                    host == "kgimg.com" || host.endsWith(".kgimg.com")
                val secure = if (kgHost && uri?.scheme == "http") url.replaceFirst("http:", "https:") else url
                val reduced = if (song.type == SongType.KG && kgHost) {
                    listOf(SIZE_XLARGE, SIZE_MEDIUM).map { size ->
                        getKgImageUrl(secure, size)
                    }
                } else emptyList()
                listOf(secure) + reduced + url
            }
            .filter { url ->
                runCatching {
                    val uri = java.net.URI(url)
                    uri.scheme in listOf("http", "https") && !uri.host.isNullOrBlank() && uri.rawUserInfo == null
                }.getOrDefault(false)
            }.distinct()
    }

    private fun getWyCoverSizeUrl(url: String?, size: Int?, fallback: String = ""): String {
        return try {
            val raw = url?.trim().orEmpty()
            if (raw.isBlank()) return fallback
            val imageUrl = raw.replace(Regex("^http:"), "https:")
            val sizeUrl = size?.let { "?param=${it}y$it" }.orEmpty()
            when {
                size != null && Regex("([?&])param=[0-9]+y[0-9]+").containsMatchIn(imageUrl) ->
                    imageUrl.replace(Regex("([?&])param=[0-9]+y[0-9]+")) { match ->
                        match.groupValues[1] + "param=" + size + "y" + size
                    }
                size != null && Regex("thumbnail=[0-9]+y[0-9]+").containsMatchIn(imageUrl) ->
                    imageUrl.replace(Regex("thumbnail=[0-9]+y[0-9]+"), "thumbnail=" + size + "y" + size)
                imageUrl.endsWith(".jpg") -> imageUrl + sizeUrl
                size != null && Regex("(?i)[.](jpg|jpeg|png|webp)([?].*)?$").containsMatchIn(imageUrl) ->
                    imageUrl + (if (imageUrl.contains('?')) "&" else "?") + "param=" + size + "y" + size
                imageUrl.endsWith("&") -> {
                    val nextUrl = imageUrl + "cl"
                    nextUrl.replace(
                        Regex("thumbnail=[0-9]+y[0-9]+&cl"),
                        "thumbnail=${size}y${size}&",
                    )
                }
                else -> imageUrl
            }
        } catch (_: Exception) {
            fallback
        }
    }

    private fun normalizeSize(size: Int): Int =
        when (size) {
            SIZE_MEDIUM -> SIZE_MEDIUM
            SIZE_LARGE -> SIZE_LARGE
            SIZE_XLARGE -> SIZE_XLARGE
            SIZE_PLAYER -> SIZE_PLAYER
            SIZE_DETAIL -> SIZE_DETAIL
            else -> SIZE_SMALL
        }

    private fun wySizeOf(size: Int): Int =
        when (normalizeSize(size)) {
            SIZE_SMALL -> 100
            SIZE_MEDIUM -> 300
            SIZE_LARGE -> 1024
            SIZE_XLARGE -> 1920
            SIZE_PLAYER -> SIZE_PLAYER
            SIZE_DETAIL -> SIZE_DETAIL
            else -> 100
        }
}
