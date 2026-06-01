package cn.partialy.pm.model

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.Serializable

// 推荐歌曲相关
@Serializable
data class RecommendSongInfo(
    val songname: String,
    val author_name: String,
    val hash: String,
    val sizable_cover: String,
    val sourceType: SongType? = null,
    val albumName: String? = null,
    val duration: Int? = null,
) {
    fun convertToSongInfo(): SongInfo {
        val source = sourceType ?: SongType.KG
        return SongInfo(
            id = hash,
            type = source,
            name = songname,
            artist = author_name,
            coverUrl = sizable_cover,
            album = albumName,
            duration = duration,
        )
    }
}

@Serializable
data class RecommendSongResponse(
    val creation_date: String,
    val song_list_size: Int,
    val song_list: List<RecommendSongInfo>,
)

data class TopCardApiResponse(
    val status: Int,
    @SerializedName("error_code") val errorCode: Int,
    val data: TopCardData? = null,
)

data class TopCardData(
    @SerializedName("song_list_size") val songListSize: Int = 0,
    @SerializedName("rec_desc") val recDesc: String = "",
    @SerializedName("song_list") val songList: List<RecommendSongInfo> = emptyList(),
    @SerializedName("card_id") val cardId: Int = 0,
)

/** 首页推荐歌单（来自 /top/playlist?category_id=0） */
data class HomeRecommendPlaylist(
    val id: String,
    val name: String,
    val coverUrl: String,
    val playCountLabel: String,
    val trackCount: Int = 0,
    val sourceType: CollectedPlaylistType = CollectedPlaylistType.KG,
)

/** GET top/playlist 接口外层 JSON（Gson） */
data class TopPlaylistApiResponse(
    val status: Int,
    @SerializedName("error_code") val errorCode: Int,
    val data: TopPlaylistData? = null,
)

data class TopPlaylistData(
    @SerializedName("has_next") val hasNext: Int = 0,
    val total: Int = 0,
    @SerializedName("bi_biz") val biBiz: String? = null,
    @SerializedName("session") val session: String? = null,
    @SerializedName("alg_id") val algId: Int? = null,
    @SerializedName("special_list") val specialList: List<TopPlaylistSpecialItem>? = null,
)

data class KgPlaylistTagsApiResponse(
    val status: Int = 0,
    @SerializedName("error_code") val errorCode: Int = 0,
    val data: List<KgPlaylistTagParent> = emptyList(),
)

data class KgPlaylistTagParent(
    @SerializedName("parent_id") val parentId: String = "",
    @SerializedName("sort") val sort: String = "",
    @SerializedName("tag_id") val tagId: String = "",
    @SerializedName("tag_name") val tagName: String = "",
    @SerializedName("son") val children: List<KgPlaylistTagChild> = emptyList(),
)

data class KgPlaylistTagChild(
    @SerializedName("parent_id") val parentId: String = "",
    @SerializedName("tag_id") val tagId: String = "",
    @SerializedName("tag_name") val tagName: String = "",
    @SerializedName("sort") val sort: String = "",
)

data class TopPlaylistSpecialItem(
    @SerializedName("flexible_cover") val flexibleCover: String = "",
    val show: String = "",
    @SerializedName("specialname") val specialName: String = "",
    @SerializedName("imgurl") val imgUrl: String = "",
    @SerializedName("play_count") val playCount: Long = 0,
    val pic: String = "",
    @SerializedName("from_hash") val fromHash: String = "",
    @SerializedName("global_collection_id") val globalCollectionId: String = "",
    val intro: String = "",
    @SerializedName("collectcount") val collectCount: Long = 0,
)

// ========== KG 歌单详情 /playlist/detail ==========

/** /playlist/detail 外层 JSON（Gson） */
data class KgPlaylistDetailApiResponse(
    val status: Int = 0,
    @SerializedName("error_code") val errorCode: Int = 0,
    val data: List<KgPlaylistDetailItem> = emptyList(),
)

data class KgPlaylistDetailItem(
    val tags: String = "",
    val intro: String = "",
    val count: Int = 0,
    val name: String = "",
    val pic: String = "",
    @SerializedName("global_collection_id") val globalCollectionId: String = "",
    @SerializedName("list_create_username") val createUsername: String = "",
    @SerializedName("list_create_userid") val createUserId: Long = 0,
)

// ========== KG 歌单歌曲 /playlist/track/all ==========

/** /playlist/track/all 外层 JSON（Gson） */
data class KgPlaylistTrackAllApiResponse(
    val status: Int = 0,
    @SerializedName("error_code") val errorCode: Int = 0,
    val data: KgPlaylistTrackAllData? = null,
)

data class KgPlaylistTrackAllData(
    val pagesize: Int = 0,
    val count: Int = 0,
    val page: Int = 0,
    val info: List<KgPlaylistTrackRow> = emptyList(),
    val userid: Long = 0,
)

data class KgPlaylistTrackRow(
    val hash: String = "",
    val size: Long = 0,
    val name: String = "",
    @SerializedName("album_id") val albumId: String = "",
    val extname: String = "",
    val remark: String = "",
    val timelen: Int = 0,
    val bitrate: Int = 0,
    val cover: String = "",
    @SerializedName("mixsongid") val mixSongId: Long = 0,
    val albuminfo: KgPlaylistAlbumInfo? = null,
    val singerinfo: List<KgPlaylistSingerInfo> = emptyList(),
)

data class KgPlaylistAlbumInfo(
    val name: String = "",
    val id: Long = 0,
    val publish: Int = 0,
)

data class KgPlaylistSingerInfo(
    val id: Long = 0,
    val publish: Int = 0,
    val name: String = "",
    val avatar: String = "",
    val type: Int = 0,
)

// 搜索歌曲相关（与 pmNative KgSongItem / KgSearchData 对齐，Gson）

/** 蓝源 /register/dev */
data class KgRegisterDevResponse(
    val data: KgRegisterDevData? = null,
    @SerializedName("error_code") val errorCode: Int = 0,
    val status: Int = 0,
)

data class KgRegisterDevData(
    val dfid: String? = null,
)

data class SearchSongInfo(
    @SerializedName("FileHash") val fileHash: String = "",
    @SerializedName("SongName") val songName: String = "",
    @SerializedName("SingerName") val singerName: String = "",
    @SerializedName("FileName") val fileName: String = "",
    @SerializedName("Image") val image: String? = null,
    @SerializedName("HQFileHash") val hqFileHash: String? = null,
    @SerializedName("SQFileHash") val sqFileHash: String? = null,
    @SerializedName("Duration") val duration: Int = 0,
    @SerializedName("songname_suffix") val songnameSuffix: String? = null,
) {
    fun displayTitle(): String = buildString {
        append(songName)
        songnameSuffix?.trim()?.takeIf { it.isNotEmpty() }?.let { append(it) }
    }

    fun playHash(): String {
        var h = sqFileHash.orEmpty()
        if (h.isEmpty()) h = hqFileHash.orEmpty()
        if (h.isEmpty()) h = fileHash
        return h
    }

    fun convertToSong(): SongInfo? {
        return try {
            val id = playHash()
            if (id.isEmpty()) return null
            SongInfo(
                id = id,
                type = SongType.KG,
                name = displayTitle(),
                album = null,
                artist = singerName,
                coverUrl = image.orEmpty().replace("{size}", "120"),
                lyric = null,
                duration = duration,
            )
        } catch (e: Exception) {
            println(e)
            null
        }
    }
}

data class SearchSongResponse(
    val pagesize: Int = 0,
    val size: Int = 0,
    val page: Int = 0,
    val total: Int = 0,
    val lists: List<SearchSongInfo> = emptyList(),
)

/** KG 歌单搜索 raw data */
data class KgSearchPlaylistResponse(
    val pagesize: Int = 0,
    val size: Int = 0,
    val page: Int = 0,
    val total: Int = 0,
    val lists: List<KgSearchPlaylistItem> = emptyList(),
)

data class KgSearchPlaylistItem(
    @SerializedName("specialid") val specialId: Long = 0L,
    @SerializedName("gid") val gid: String = "",
    @SerializedName("specialname") val specialName: String = "",
    @SerializedName("song_count") val songCount: Int = 0,
    @SerializedName("img") val img: String = "",
    @SerializedName("contain") val contain: String = "",
    @SerializedName("play_count") val playCount: String = "",
    @SerializedName("total_play_count") val totalPlayCount: String = "",
)

/** 统一歌单搜索展示模型 */
data class SearchPlaylistInfo(
    val id: String,
    val name: String,
    val coverUrl: String,
    val songCount: Int,
    val includeSongName: String = "",
    val playCount: Long = 0L,
    val source: SongType = SongType.KG,
)

data class SearchPlaylistResponse(
    val lists: List<SearchPlaylistInfo>,
    val page: Int,
    val pagesize: Int,
    val total: Int,
)

// 歌曲 URL（proxy/kg song/url，与 pmNative KgSongUrlResponse 对齐）
data class KgSongUrlData(
    val url: List<String> = emptyList(),
    @SerializedName("backupUrl") val backupUrl: List<String> = emptyList(),
)

data class KgSongUrlResponse(
    @SerializedName("error_msg") val errorMsg: String = "",
    @SerializedName("error_code") val errorCode: Int = 0,
    val status: Int = 0,
    val data: KgSongUrlData? = null,
    /** 部分网关返回扁平 body，无 data 包裹 */
    val url: List<String> = emptyList(),
    @SerializedName("backupUrl") val backupUrl: List<String> = emptyList(),
    val extName: String? = null,
    @SerializedName("fail_process") val failProcess: List<String>? = null,
)

fun KgSongUrlData.pickFirstStreamUrl(): String? =
    url.firstOrNull { it.isNotBlank() }
        ?: backupUrl.firstOrNull { it.isNotBlank() }

fun KgSongUrlResponse.pickKgStreamUrl(): String? =
    data?.pickFirstStreamUrl()
        ?: url.firstOrNull { it.isNotBlank() }
        ?: backupUrl.firstOrNull { it.isNotBlank() }

// 歌词相关（与 pmNative KgLyric* 对齐）
data class SearchLyricResponse(
    val status: Int = 0,
    val info: String = "",
    val candidates: List<LyricCandidate> = emptyList(),
)

data class LyricCandidate(
    val id: String = "",
    val accesskey: String = "",
    val singer: String = "",
    val song: String = "",
)

data class LyricResponse(
    val status: Int = 0,
    val info: String = "",
    @SerializedName("error_code") val errorCode: Int = 0,
    val fmt: String? = null,
    val content: String? = null,
    @SerializedName("decodeContent") val decodeContent: String? = null,
)

// 热门搜索相关
data class SearchKeyword(
    val reason: String,
    val json_url: String,
    val jumpurl: String,
    val keyword: String,
    val is_cover_word: Int,
    val type: Int,
    val icon: Int
)

data class HotSearchInfo(
    val name: String,
    val keywords: List<SearchKeyword>
)

data class HotSearchResponse(
    val timestamp: Long,
    val list: List<HotSearchInfo>
)

// 新歌相关
data class Author(
    val sizable_avatar: String,
    val author_name: String
)

data class NewSongInfo(
    val songname: String,
    val hash: String,
    val authors: List<Author>
)

data class NewSongResponse(
    val data: List<NewSongInfo>
)
