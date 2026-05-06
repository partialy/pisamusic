package cn.partialy.pm.network.kw

import com.google.gson.annotations.SerializedName

/** apidoc：搜索单曲 quality 档位，size 为可读字符串如 "27.89MB" */
data class KwQualityEntry(
    val size: String? = null,
)

data class KwQualityBlock(
    val lossless: KwQualityEntry? = null,
    val exhigh: KwQualityEntry? = null,
    val standard: KwQualityEntry? = null,
)

data class KwSearchItem(
    val album: String? = null,
    @SerializedName("album_id") val albumId: Long? = null,
    val artist: String = "",
    val duration: Int = 0,
    val name: String = "",
    val id: Long = 0,
    val quality: KwQualityBlock? = null,
)

/** GET /search（与 pmNative KwSearchResponse 对齐） */
data class KwSearchResponse(
    val msg: String = "",
    val data: List<KwSearchItem>? = null,
)

/** GET /url */
data class KwUrlResponse(
    val msg: String = "",
    val quality: String? = null,
    val url: String? = null,
)

fun KwUrlResponse.pickUrl(): String? = url?.takeIf { it.isNotBlank() }
