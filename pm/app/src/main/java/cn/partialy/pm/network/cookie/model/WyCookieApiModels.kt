package cn.partialy.pm.network.cookie.model

import com.google.gson.annotations.SerializedName

/** [needCookieAPI.md] 网易 `/user/account` */
data class WyAccountResponse(
    @SerializedName("code") val code: Int? = null,
    @SerializedName("account") val account: WyAccount? = null,
    @SerializedName("profile") val profile: WyProfile? = null,
)

data class WyAccount(
    @SerializedName("id") val id: Long? = null,
    @SerializedName("userName") val userName: String? = null,
    @SerializedName("type") val type: Int? = null,
    @SerializedName("status") val status: Int? = null,
)

data class WyProfile(
    @SerializedName("userId") val userId: Long? = null,
    @SerializedName("nickname") val nickname: String? = null,
    @SerializedName("avatarUrl") val avatarUrl: String? = null,
    @SerializedName("backgroundUrl") val backgroundUrl: String? = null,
    @SerializedName("signature") val signature: String? = null,
)

/** [needCookieAPI.md] 网易 `/user/playlist` */
data class WyUserPlaylistResponse(
    @SerializedName("more") val more: Boolean? = null,
    @SerializedName("playlist") val playlist: List<WyPlaylistItem>? = null,
    @SerializedName("code") val code: Int? = null,
)

data class WyPlaylistItem(
    @SerializedName("id") val id: Long? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("coverImgUrl") val coverImgUrl: String? = null,
    @SerializedName("trackCount") val trackCount: Int? = null,
    @SerializedName("playCount") val playCount: Long? = null,
    @SerializedName("description") val description: String? = null,
)
