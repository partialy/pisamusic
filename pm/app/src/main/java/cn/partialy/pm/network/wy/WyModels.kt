package cn.partialy.pm.network.wy

import com.google.gson.annotations.SerializedName

// --- cloudSearch（与 pmNative WyCloudSearchResponse / WySong 对齐） ---

data class WyCloudSearchResponse(
    val result: WyCloudSearchResult? = null,
    val code: Int? = null,
)

data class WyCloudSearchResult(
    val songs: List<WySongDto>? = null,
    val playlists: List<WyPlaylistDto>? = null,
    val playlistCount: Int? = null,
)

data class WySongDto(
    val id: Long = 0,
    val name: String = "",
    val ar: List<WyArtistDto> = emptyList(),
    val al: WyAlbumDto? = null,
)

data class WyAlbumDto(
    val id: Long = 0,
    val name: String = "",
    @SerializedName("picUrl") val picUrl: String? = null,
)

data class WyArtistDto(
    val id: Long = 0,
    val name: String = "",
)

data class WyPlaylistDto(
    val id: Long = 0L,
    val name: String = "",
    @SerializedName("coverImgUrl") val coverImgUrl: String = "",
    @SerializedName("trackCount") val trackCount: Int = 0,
    @SerializedName("playCount") val playCount: Long = 0L,
    val creator: WyPlaylistCreatorDto? = null,
)

data class WyPlaylistCreatorDto(
    val nickname: String = "",
)

// --- song/url & v1 & download（与 pmNative WySongUrl* 对齐） ---

data class WySongUrlResponse(
    val code: Int = 0,
    val data: List<WySongUrlItemDto> = emptyList(),
)

data class WySongUrlItemDto(
    val id: Long = 0,
    val url: String? = null,
    val br: Int = 0,
    val code: Int = 0,
)

typealias WySongUrlV1Response = WySongUrlResponse

// --- lyric ---

data class WyLyricResponse(
    val code: Int? = null,
    val lrc: WyLrcDto? = null,
)

data class WyLrcDto(
    val version: Int? = null,
    val lyric: String? = null,
)
