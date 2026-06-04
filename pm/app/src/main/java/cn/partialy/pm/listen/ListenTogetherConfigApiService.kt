package cn.partialy.pm.listen

import retrofit2.http.GET

interface ListenTogetherConfigApiService {
    @GET("api/listen-together/config")
    suspend fun getListenTogetherConfig(): ListenTogetherConfigResponse
}
