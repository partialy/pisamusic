package cn.partialy.pm.network.cookie.model

/** detail.tracks 是截断预览，完整性只能使用明确的 trackIds 与 trackCount。 */
data class WyPlaylistDetailAuthorityResponse(
    val code: Int? = null,
    val playlist: WyPlaylistDetailAuthority? = null,
)

data class WyPlaylistDetailAuthority(
    val id: Long? = null,
    val trackCount: Int? = null,
    val trackIds: List<WyPlaylistAuthorityTrack?>? = null,
    val name: String? = null,
    val coverImgUrl: String? = null,
    val description: String? = null,
    val playCount: Long? = null,
)

data class WyPlaylistAuthorityTrack(val id: Long? = null)
