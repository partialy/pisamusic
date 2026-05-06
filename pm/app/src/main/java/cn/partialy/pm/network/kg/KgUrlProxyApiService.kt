package cn.partialy.pm.network.kg

import cn.partialy.pm.model.KgSongUrlResponse
import retrofit2.http.GET
import retrofit2.http.Query
import retrofit2.http.Url

/**
 * 酷狗获取播放/下载 URL（apidoc：须走 `proxy-service/proxy/kg`，与 `kg-service` 业务接口分离）。
 */
interface KgUrlProxyApiService {

    @GET
    suspend fun getSongUrl(
        @Url url: String,
        @Query("hash") hash: String,
        @Query("album_id") albumId: Long? = null,
        @Query("free_part") freePart: Boolean? = null,
        @Query("album_audio_id") albumAudioId: Long? = null,
        @Query("quality") quality: String? = null,
    ): KgSongUrlResponse
}
