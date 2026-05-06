package cn.partialy.pm.network.cookie.model

import com.google.gson.annotations.SerializedName

/** [needCookieAPI.md] 酷狗 `/user/playlist` */
data class KgUserPlaylistResponse(
    @SerializedName("data") val data: KgUserPlaylistData? = null,
    @SerializedName("status") val status: Int? = null,
    @SerializedName("error_code") val errorCode: Int? = null,
)

data class KgUserPlaylistData(
    @SerializedName("info") val info: List<KgUserPlaylistInfoItem>? = null,
    @SerializedName("userid") val userid: Long? = null,
    @SerializedName("album_count") val albumCount: Int? = null,
    @SerializedName("list_count") val listCount: Int? = null,
    @SerializedName("collect_count") val collectCount: Int? = null,
)

data class KgUserPlaylistInfoItem(
    @SerializedName("name") val name: String? = null,
    @SerializedName("listid") val listid: Int? = null,
    @SerializedName("global_collection_id") val globalCollectionId: String? = null,
    @SerializedName("count") val count: Int? = null,
    @SerializedName("pic") val pic: String? = null,
    @SerializedName("create_user_pic") val createUserPic: String? = null,
    @SerializedName("list_create_username") val listCreateUsername: String? = null,
)
