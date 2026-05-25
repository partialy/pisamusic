package cn.partialy.pm.model

import com.google.gson.annotations.SerializedName

/** 收藏/自建歌单统一结构；自建本地歌单以 SQLite 为主存储，JSON 仅作导入导出兼容。 */
enum class CollectedPlaylistType {
    @SerializedName("wy")
    WY,

    @SerializedName("kg")
    KG,

    /** 侧栏“导入酷狗歌单”批量写入收藏，与 [KG] 详情页行为一致。 */
    @SerializedName("import-kg")
    IMPORT_KG,

    /** 侧栏“导入网易云歌单”批量写入收藏。 */
    @SerializedName("import-wy")
    IMPORT_WY,

    @SerializedName("local")
    LOCAL,
    ;

    companion object
}

data class CollectedPlaylist(
    val type: CollectedPlaylistType,
    val id: String,
    val name: String,
    val intro: String = "",
    val cover: String = "",
    /** 曲目数量：网络歌单来自接口；本地歌单由 SQLite 关联表统计。 */
    val count: Int = 0,
)
