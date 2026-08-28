package cn.partialy.pm.model

import androidx.annotation.StringRes
import cn.partialy.pm.R

/**
 * 下载前选择的音质；与 [downloadOptionsForSongType] 及各 Repository 取链参数对应。
 * 网易分两类：song/url + br、[song/url/v1 + level](WyUrlProxyApiService)。
 */
sealed class DownloadQualityChoice {
    data class Kugou(val quality: String) : DownloadQualityChoice()

    /** 网易 song/url（码率 br） */
    data class NeteaseBr(val br: Int) : DownloadQualityChoice()

    /** 网易 song/url/v1（level） */
    data class NeteaseLevel(val level: String) : DownloadQualityChoice()

    /** 酷我 /url quality */
    data class Kuwo(val quality: String) : DownloadQualityChoice()

    /** 网盘歌曲由服务端按原始文件签发唯一播放地址。 */
    object CloudDefault : DownloadQualityChoice()
}

data class DownloadQualityOption(
    @StringRes val labelRes: Int,
    val choice: DownloadQualityChoice,
    val enabled: Boolean = true,
    @StringRes val badgeRes: Int? = null,
)

fun DownloadQualityChoice.toPlaybackQualityKey(): String = when (this) {
    is DownloadQualityChoice.Kugou -> "kg:$quality"
    is DownloadQualityChoice.NeteaseBr -> "wy-br:$br"
    is DownloadQualityChoice.NeteaseLevel -> "wy-level:$level"
    is DownloadQualityChoice.Kuwo -> "kw:$quality"
    DownloadQualityChoice.CloudDefault -> "cloud:default"
}

fun DownloadQualityChoice.matchesSongType(type: SongType): Boolean = when (this) {
    is DownloadQualityChoice.Kugou -> type == SongType.KG
    is DownloadQualityChoice.NeteaseBr,
    is DownloadQualityChoice.NeteaseLevel,
    -> type == SongType.WY
    is DownloadQualityChoice.Kuwo -> type == SongType.KW
    DownloadQualityChoice.CloudDefault -> type == SongType.CLOUD
}

fun playbackQualityChoiceFromKey(key: String?): DownloadQualityChoice? {
    if (key.isNullOrBlank()) return null
    val separator = key.indexOf(':')
    if (separator <= 0 || separator == key.lastIndex) return null
    val prefix = key.substring(0, separator)
    val value = key.substring(separator + 1)
    return when (prefix) {
        "kg" -> DownloadQualityChoice.Kugou(value)
        "kw" -> DownloadQualityChoice.Kuwo(value)
        "wy-br" -> value.toIntOrNull()?.let { DownloadQualityChoice.NeteaseBr(it) }
        "wy-level" -> DownloadQualityChoice.NeteaseLevel(value)
        "cloud" -> DownloadQualityChoice.CloudDefault.takeIf { value == "default" }
        else -> null
    }
}

fun downloadOptionsForSongType(type: SongType): List<DownloadQualityOption> = when (type) {
    SongType.KG -> kgDownloadOptions
    SongType.WY -> wyDownloadOptions
    SongType.KW -> kwDownloadOptions
    SongType.CLOUD -> cloudDownloadOptions
    SongType.LOCAL -> emptyList()
}

/** apidoc：128 / 320 / flac / high / viper_atmos / viper_clear */
private val kgDownloadOptions = listOf(
    DownloadQualityOption(R.string.quality_kg_128, DownloadQualityChoice.Kugou("128")),
    DownloadQualityOption(R.string.quality_kg_320, DownloadQualityChoice.Kugou("320")),
    DownloadQualityOption(R.string.quality_kg_flac, DownloadQualityChoice.Kugou("flac")),
    DownloadQualityOption(R.string.quality_kg_high, DownloadQualityChoice.Kugou("high")),
    DownloadQualityOption(R.string.quality_kg_viper_atmos, DownloadQualityChoice.Kugou("viper_atmos")),
    DownloadQualityOption(R.string.quality_kg_viper_clear, DownloadQualityChoice.Kugou("viper_clear")),
)

private val wyDownloadOptions = listOf(
    DownloadQualityOption(R.string.quality_wy_br_128, DownloadQualityChoice.NeteaseBr(128_000)),
    DownloadQualityOption(R.string.quality_wy_br_320, DownloadQualityChoice.NeteaseBr(320_000)),
    DownloadQualityOption(R.string.quality_wy_br_max, DownloadQualityChoice.NeteaseBr(999_000)),
    DownloadQualityOption(R.string.quality_wy_standard, DownloadQualityChoice.NeteaseLevel("standard")),
    DownloadQualityOption(R.string.quality_wy_higher, DownloadQualityChoice.NeteaseLevel("higher")),
    DownloadQualityOption(R.string.quality_wy_exhigh, DownloadQualityChoice.NeteaseLevel("exhigh")),
    DownloadQualityOption(R.string.quality_wy_lossless, DownloadQualityChoice.NeteaseLevel("lossless")),
    DownloadQualityOption(R.string.quality_wy_hires, DownloadQualityChoice.NeteaseLevel("hires")),
    DownloadQualityOption(R.string.quality_wy_surround, DownloadQualityChoice.NeteaseLevel("jyeffect")),
    DownloadQualityOption(R.string.quality_wy_sky, DownloadQualityChoice.NeteaseLevel("sky")),
    DownloadQualityOption(R.string.quality_wy_dolby, DownloadQualityChoice.NeteaseLevel("dolby")),
    DownloadQualityOption(R.string.quality_wy_master, DownloadQualityChoice.NeteaseLevel("jymaster")),
)

private val kwDownloadOptions = listOf(
    DownloadQualityOption(R.string.quality_kw_standard, DownloadQualityChoice.Kuwo("standard")),
    DownloadQualityOption(R.string.quality_kw_exhigh, DownloadQualityChoice.Kuwo("exhigh")),
    DownloadQualityOption(R.string.quality_kw_lossless, DownloadQualityChoice.Kuwo("lossless")),
)

private val cloudDownloadOptions = listOf(
    DownloadQualityOption(R.string.quality_cloud_default, DownloadQualityChoice.CloudDefault),
)
