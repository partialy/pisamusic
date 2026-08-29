package cn.partialy.pm.network.cloudmusic

/** 外层 system API 的标准 success/code/msg/data 信封。 */
data class CloudMusicEnvelope<T>(
    val msg: String = "",
    val code: Int = -1,
    val success: Boolean = false,
    val data: T? = null,
)

data class CloudMusicSummaryDto(
    val total: Int = 0,
    val latestUpdatedAt: Long? = null,
    val myContributions: Int = 0,
)

data class CloudMusicSearchDto(
    val source: String = "cloud",
    val items: List<CloudMusicTrackDto> = emptyList(),
    val total: Int = 0,
    val offset: Int = 0,
    val limit: Int = 0,
)

data class CloudMusicTrackDto(
    val uuid: String = "",
    val source: String = "cloud",
    val title: String = "",
    val artist: String = "",
    val album: String? = null,
    val durationMs: Long = 0L,
    val format: String? = null,
    val playable: Boolean = true,
    val status: String? = null,
    val statusReason: String? = null,
    val cover: CloudMusicCoverDto? = null,
    val lyrics: CloudMusicLyricsDto? = null,
    val createdAt: Long? = null,
    val updatedAt: Long? = null,
)

data class CloudMusicCoverDto(
    val source: String = "default",
    val url: String = "",
)

data class CloudMusicLyricsDto(
    val format: String? = null,
    val fileName: String? = null,
)

/** 临时资源地址只在内存中使用，绝不能写回 SongInfo 或业务存储。 */
data class CloudMusicSignedResourceDto(
    val uuid: String = "",
    val source: String = "cloud",
    val url: String = "",
    val expiresAt: Long = 0L,
    val format: String? = null,
)
