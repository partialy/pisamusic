package cn.partialy.pm.network.kw

import retrofit2.http.GET
import retrofit2.http.Query

/**
 * 酷我获取播放 URL（apidoc：下载/取链须走 `proxy-service/proxy/kw`）。
 */
interface KwUrlProxyApiService {

    @GET("url")
    suspend fun getPlayUrl(
        @Query("id") id: Long,
        @Query("quality") quality: String = "standard",
    ): KwUrlResponse
}
