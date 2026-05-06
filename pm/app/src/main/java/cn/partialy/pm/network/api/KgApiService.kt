package cn.partialy.pm.network.api

import cn.partialy.pm.model.BaseResponse
import cn.partialy.pm.model.HotSearchResponse
import cn.partialy.pm.model.KgPlaylistDetailApiResponse
import cn.partialy.pm.model.KgPlaylistTagsApiResponse
import cn.partialy.pm.model.KgSearchPlaylistResponse
import cn.partialy.pm.model.KgPlaylistTrackAllApiResponse
import cn.partialy.pm.model.KgRegisterDevResponse
import cn.partialy.pm.model.LyricResponse
import cn.partialy.pm.model.NewSongResponse
import cn.partialy.pm.model.RecommendSongResponse
import cn.partialy.pm.model.SearchLyricResponse
import cn.partialy.pm.model.SearchSongResponse
import cn.partialy.pm.model.TopCardApiResponse
import cn.partialy.pm.model.TopPlaylistApiResponse
import retrofit2.http.GET
import retrofit2.http.Query

interface KgApiService {
    @GET("register/dev")
    suspend fun registerDev(): KgRegisterDevResponse

    @GET("everyday/recommend")
    suspend fun getRecommendSongs(): BaseResponse<RecommendSongResponse>

    @GET("top/card")
    suspend fun getTopCard(
        @Query("card_id") cardId: Int,
    ): TopCardApiResponse

    @GET("search")
    suspend fun searchSong(
        @Query("keywords") keyword: String,
        @Query("page") page: Int = 1,
        @Query("pagesize") pagesize: Int = 20,
        @Query("type") type: String? = null,
    ): BaseResponse<SearchSongResponse>

    @GET("search")
    suspend fun searchPlaylist(
        @Query("keywords") keyword: String,
        @Query("page") page: Int = 1,
        @Query("pagesize") pagesize: Int = 20,
        @Query("type") type: String = "special",
    ): BaseResponse<KgSearchPlaylistResponse>

    @GET("search/lyric")
    suspend fun searchLyric(
        @Query("hash") hash: String,
        @Query("man") man: String? = null,
    ): SearchLyricResponse

    @GET("search/lyric")
    suspend fun searchLyricByKeywords(
        @Query("keywords") keywords: String,
        @Query("man") man: String? = null,
    ): SearchLyricResponse

    @GET("lyric")
    suspend fun getLyric(
        @Query("id") id: String,
        @Query("accesskey") accesskey: String,
        @Query("fmt") fmt: String? = null,
        @Query("decode") decode: Boolean? = null,
    ): LyricResponse

    @GET("search/hot")
    suspend fun getHotSongs(): BaseResponse<HotSearchResponse>

    @GET("top/song")
    suspend fun getNewSongs(): BaseResponse<NewSongResponse>

    @GET("search/suggest")
    suspend fun getLinkKeyword(
        @Query("keywords") keywords: String
    ): BaseResponse<SearchSongResponse>

    /** 歌单推荐，见 REDME.MD */
    @GET("top/playlist")
    suspend fun getTopPlaylists(
        @Query("category_id") categoryId: Int = 0,
        @Query("withsong") withsong: Int? = 0,
        @Query("page") page: Int? = null,
        @Query("pagesize") pagesize: Int? = null,
    ): TopPlaylistApiResponse

    @GET("playlist/tags")
    suspend fun getPlaylistTags(): KgPlaylistTagsApiResponse

    /** 歌单详情：/playlist/detail?ids=collection_xxx[,collection_yyy] */
    @GET("playlist/detail")
    suspend fun getPlaylistDetail(
        @Query("ids") ids: String,
    ): KgPlaylistDetailApiResponse

    /** 歌单全部歌曲：/playlist/track/all?id=collection_xxx&page=&pagesize= */
    @GET("playlist/track/all")
    suspend fun getPlaylistTrackAll(
        @Query("id") id: String,
        @Query("page") page: Int = 1,
        @Query("pagesize") pagesize: Int = 30,
    ): KgPlaylistTrackAllApiResponse
}