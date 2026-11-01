package cn.partialy.pm.download

import cn.partialy.pm.model.*

/** 只降级或切换同档接口，不使用播放器自动选档（自动选档可能升级）。 */
fun downloadQualityCandidates(
    type: SongType,
    requested: DownloadQualityChoice,
    access: MusicQualityAccessState,
): List<DownloadQualityChoice> {
    if (!MusicQualityAccessPolicy.isChoiceAllowed(type, requested, access)) return emptyList()
    val rank = downloadQualityRank(requested)
    val fallback = downloadOptionsForSongType(type).map { it.choice }
        .filter { downloadQualityRank(it) <= rank }
        .sortedByDescending(::downloadQualityRank)
    return (listOf(requested) + fallback).distinct()
        .filter { MusicQualityAccessPolicy.isChoiceAllowed(type, it, access) }
}

internal fun downloadQualityRank(choice: DownloadQualityChoice): Int = when (choice) {
    is DownloadQualityChoice.Kugou -> listOf("128", "320", "flac", "high", "viper_atmos", "viper_clear").indexOf(choice.quality)
    is DownloadQualityChoice.NeteaseBr -> when {
        choice.br <= 128_000 -> 0
        choice.br <= 320_000 -> 2
        else -> 3
    }
    is DownloadQualityChoice.NeteaseLevel -> listOf("standard", "higher", "exhigh", "lossless", "hires", "jyeffect", "sky", "dolby", "jymaster").indexOf(choice.level)
    is DownloadQualityChoice.Kuwo -> listOf("standard", "exhigh", "lossless").indexOf(choice.quality)
    DownloadQualityChoice.CloudDefault -> 0
}

/** br 只能可靠区分有损档位；FLAC 码率不能推断位深/采样率，更不能把 hires 记为 lossless。 */
internal fun reportedWyDownloadChoice(
    requested: DownloadQualityChoice,
    bitrate: Int,
    level: String?,
): DownloadQualityChoice {
    val reportedLevel = level?.lowercase()?.let { DownloadQualityChoice.NeteaseLevel(it) }
        ?.takeIf { downloadQualityRank(it) >= 0 }
    if (reportedLevel != null) {
        if (downloadQualityRank(reportedLevel) > downloadQualityRank(requested)) {
            throw DownloadResolutionException(DownloadFailureKind.UNAVAILABLE)
        }
        return if (downloadQualityRank(reportedLevel) == downloadQualityRank(requested)) requested else reportedLevel
    }
    if (bitrate <= 0) return requested
    val rank = when { bitrate <= 128_000 -> 0; bitrate <= 192_000 -> 1; bitrate <= 320_000 -> 2; else -> 3 }
    if (rank > downloadQualityRank(requested)) throw DownloadResolutionException(DownloadFailureKind.UNAVAILABLE)
    // 高档没有 level 时保留所请求的档位；不根据可变 FLAC 码率虚构降档。
    if (rank >= 3 || rank == downloadQualityRank(requested)) return requested
    return if (requested is DownloadQualityChoice.NeteaseBr && rank != 1) {
        DownloadQualityChoice.NeteaseBr(if (rank == 0) 128_000 else 320_000)
    } else DownloadQualityChoice.NeteaseLevel(listOf("standard", "higher", "exhigh")[rank])
}
