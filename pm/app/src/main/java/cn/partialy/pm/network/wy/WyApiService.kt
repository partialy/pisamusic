package cn.partialy.pm.network.wy

import retrofit2.http.GET
import retrofit2.http.Query

/**
 * 网易云业务接口（apidoc 红：音源 `wy-service`）。
 * Base URL: `https://gateway.partialy.cn/wy-service/`
 *
 * 获取播放/下载 URL 见 [WyUrlProxyApiService]（须走代理）。
 */
interface WyApiService {

    @GET("cloudSearch")
    suspend fun cloudSearch(
        @Query("keywords") keywords: String,
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null,
        @Query("type") type: Int? = null,
    ): WyCloudSearchResponse

    @GET("lyric")
    suspend fun lyric(
        @Query("id") id: Long,
    ): WyLyricResponse
}
