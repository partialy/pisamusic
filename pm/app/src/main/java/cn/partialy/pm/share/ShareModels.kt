package cn.partialy.pm.share

import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.CanonicalSong

enum class ShareType(val wireValue: String) {
    SONG("song"),
    PLAYLIST("playlist"),
}

data class ShareCreateRequest(
    val type: String,
    val rawJson: Any,
)

data class ShareCreateResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: ShareCreateData? = null,
)

data class ShareCreateData(
    val uuid: String = "",
    val shareUrl: String = "",
    val appUrl: String = "",
    val share: SharePublicData = SharePublicData(),
)

data class SharePublicResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: SharePublicData? = null,
)

data class SharePublicData(
    val uuid: String = "",
    val type: String = "",
    val source: String = "",
    val sourceId: String = "",
    val title: String = "",
    val description: String = "",
    val coverUrl: String = "",
    val rawJson: Map<String, Any?> = emptyMap(),
    val sharer: SharePublicSharer = SharePublicSharer(),
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
    val accessCount: Int = 0,
    val valid: Boolean = true,
)

data class SharePublicSharer(
    val id: String = "",
    val username: String = "",
    val avatarUrl: String = "",
)

class ShareApiException(
    val apiCode: Int,
    override val message: String,
) : RuntimeException(message)

fun CanonicalSong.toShareCreateRequest(): ShareCreateRequest =
    ShareCreateRequest(
        type = ShareType.SONG.wireValue,
        rawJson = copy(),
    )

fun CanonicalPlaylist.toShareCreateRequest(): ShareCreateRequest =
    ShareCreateRequest(
        type = ShareType.PLAYLIST.wireValue,
        rawJson = copy(),
    )
