package cn.partialy.pm.network.wy

import retrofit2.http.GET
import retrofit2.http.Query
import retrofit2.http.Url

/**
 * 网易云获取播放/下载 URL（apidoc：须走 `proxy-service/proxy/wy`）。
 * Base URL: `https://gateway.partialy.cn/proxy-service/proxy/wy/`
 */
interface WyUrlProxyApiService {

    /** 可多 id，逗号分隔 */
    @GET
    suspend fun songUrl(
        @Url url: String,
        @Query("id") id: String,
        @Query("br") br: Int? = null,
    ): WySongUrlResponse

    @GET
    suspend fun songUrlV1(
        @Url url: String,
        @Query("id") id: Long,
        @Query("level") level: String,
        @Query("br") br: Int? = null,
    ): WySongUrlV1Response

    /** 仅支持单曲 id */
    @GET("song/download/url")
    suspend fun songDownloadUrl(
        @Query("id") id: Long,
        @Query("br") br: Int? = null,
    ): WySongUrlV1Response
}
