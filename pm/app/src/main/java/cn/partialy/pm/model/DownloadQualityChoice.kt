package cn.partialy.pm.model

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
}

data class DownloadQualityOption(
    val label: String,
    val choice: DownloadQualityChoice,
)

fun downloadOptionsForSongType(type: SongType): List<DownloadQualityOption> = when (type) {
    SongType.KG -> kgDownloadOptions
    SongType.WY -> wyDownloadOptions
    SongType.KW -> kwDownloadOptions
    SongType.LOCAL -> emptyList()
}

/** apidoc：128 / 320 / flac / high / viper_atmos / viper_clear */
private val kgDownloadOptions = listOf(
    DownloadQualityOption("128 kbps MP3", DownloadQualityChoice.Kugou("128")),
    DownloadQualityOption("320 kbps MP3", DownloadQualityChoice.Kugou("320")),
    DownloadQualityOption("FLAC", DownloadQualityChoice.Kugou("flac")),
    DownloadQualityOption("无损 (high)", DownloadQualityChoice.Kugou("high")),
    DownloadQualityOption("蝰蛇全景声", DownloadQualityChoice.Kugou("viper_atmos")),
    DownloadQualityOption("蝰蛇超清音质", DownloadQualityChoice.Kugou("viper_clear")),
)

private val wyDownloadOptions = listOf(
    DownloadQualityOption("[码率] 128 kbps", DownloadQualityChoice.NeteaseBr(128_000)),
    DownloadQualityOption("[码率] 320 kbps", DownloadQualityChoice.NeteaseBr(320_000)),
    DownloadQualityOption("[码率] 999000（最大）", DownloadQualityChoice.NeteaseBr(999_000)),
    DownloadQualityOption("[音质等级] 标准 standard", DownloadQualityChoice.NeteaseLevel("standard")),
    DownloadQualityOption("[音质等级] 较高 higher", DownloadQualityChoice.NeteaseLevel("higher")),
    DownloadQualityOption("[音质等级] 极高 exhigh", DownloadQualityChoice.NeteaseLevel("exhigh")),
    DownloadQualityOption("[音质等级] 无损 lossless", DownloadQualityChoice.NeteaseLevel("lossless")),
    DownloadQualityOption("[音质等级] Hi-Res", DownloadQualityChoice.NeteaseLevel("hires")),
    DownloadQualityOption("[音质等级] 高清环绕声", DownloadQualityChoice.NeteaseLevel("jyeffect")),
    DownloadQualityOption("[音质等级] 沉浸环绕声", DownloadQualityChoice.NeteaseLevel("sky")),
    DownloadQualityOption("[音质等级] 杜比全景声", DownloadQualityChoice.NeteaseLevel("dolby")),
    DownloadQualityOption("[音质等级] 超清母带", DownloadQualityChoice.NeteaseLevel("jymaster")),
)

private val kwDownloadOptions = listOf(
    DownloadQualityOption("标准 standard", DownloadQualityChoice.Kuwo("standard")),
    DownloadQualityOption("极高 exhigh", DownloadQualityChoice.Kuwo("exhigh")),
    DownloadQualityOption("无损 lossless", DownloadQualityChoice.Kuwo("lossless")),
)
