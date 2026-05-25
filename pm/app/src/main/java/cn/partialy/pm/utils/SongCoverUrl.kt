package cn.partialy.pm.utils

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType

object SongCoverUrl {
    const val SIZE_SMALL = 120
    const val SIZE_MEDIUM = 240
    const val SIZE_LARGE = 360
    const val SIZE_XLARGE = 480

    fun getKgImageUrl(url: String?, size: Int = SIZE_SMALL, fallback: String = ""): String {
        val raw = url?.trim().orEmpty()
        if (raw.isBlank()) return fallback
        return raw.replace("{size}", normalizeSize(size).toString())
    }

    fun getSongCover(song: SongInfo, size: Int = SIZE_SMALL, fallback: String = ""): String =
        getSongCover(song.type, song.coverUrl, size, fallback)

    fun getSongCover(type: SongType, coverUrl: String?, size: Int = SIZE_SMALL, fallback: String = ""): String =
        when (type) {
            SongType.LOCAL -> fallback
            SongType.KG -> getKgImageUrl(coverUrl, size, fallback)
            SongType.WY -> getWyCoverSizeUrl(coverUrl, wySizeOf(size), fallback)
            SongType.KW -> coverUrl?.trim().orEmpty().ifBlank { fallback }
        }

    fun getSongCoverData(song: SongInfo, size: Int = SIZE_SMALL, fallback: String = ""): Any? =
        song.embeddedCoverArt ?: getSongCover(song, size, fallback).takeIf { it.isNotBlank() }

    private fun getWyCoverSizeUrl(url: String?, size: Int?, fallback: String = ""): String {
        return try {
            val raw = url?.trim().orEmpty()
            if (raw.isBlank()) return fallback
            val imageUrl = raw.replace(Regex("^http:"), "https:")
            val sizeUrl = size?.let { "?param=${it}y$it" }.orEmpty()
            when {
                imageUrl.endsWith(".jpg") -> imageUrl + sizeUrl
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
            else -> SIZE_SMALL
        }

    private fun wySizeOf(size: Int): Int =
        when (normalizeSize(size)) {
            SIZE_SMALL -> 100
            SIZE_MEDIUM -> 300
            SIZE_LARGE -> 1024
            SIZE_XLARGE -> 1920
            else -> 100
        }
}
