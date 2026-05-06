package cn.partialy.pm.network.kw

import retrofit2.http.GET
import retrofit2.http.Query

/**
 * 酷我搜索（apidoc 黄：与 URL 同属 `proxy-service/proxy/kw`）。
 */
interface KwSearchApiService {

    @GET("search")
    suspend fun search(
        @Query("keywords") keywords: String,
        @Query("page") page: Int = 1,
    ): KwSearchResponse
}
