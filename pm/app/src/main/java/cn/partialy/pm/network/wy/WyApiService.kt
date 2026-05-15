package cn.partialy.pm.network.wy

import cn.partialy.pm.network.cookie.WyQrCheckEnvelope
import cn.partialy.pm.network.cookie.WyQrCreateEnvelope
import cn.partialy.pm.network.cookie.WyQrKeyEnvelope
import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
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

    @GET("captcha/sent")
    suspend fun sendLoginCaptcha(
        @Query("phone") phone: String,
        @Query("realIP") realIp: String,
    ): Response<JsonObject>

    @GET("login/cellphone")
    suspend fun loginCellphone(
        @Query("phone") phone: String,
        @Query("captcha") captcha: String,
        @Query("realIP") realIp: String,
    ): Response<JsonObject>

    @GET("login/qr/key")
    suspend fun loginQrKey(
        @Query("timestamp") timestamp: String,
        @Query("realIP") realIp: String,
    ): Response<WyQrKeyEnvelope>

    @GET("login/qr/create")
    suspend fun loginQrCreate(
        @Query("key") key: String,
        @Query("qrimg") qrimg: String,
        @Query("timestamp") timestamp: String,
        @Query("realIP") realIp: String,
        @Header("Cookie") cookie: String? = null,
    ): Response<WyQrCreateEnvelope>

    @GET("login/qr/check")
    suspend fun loginQrCheck(
        @Query("key") key: String,
        @Query("timestamp") timestamp: String,
        @Query("realIP") realIp: String,
        @Header("Cookie") cookie: String? = null,
    ): Response<WyQrCheckEnvelope>
}
