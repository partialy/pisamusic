package cn.partialy.pm.listen

import cn.partialy.pm.network.api.SystemApiService
import org.json.JSONObject
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ListenTogetherRepository @Inject constructor(
    private val systemApiService: SystemApiService,
    private val configApiService: ListenTogetherConfigApiService,
) {
    suspend fun getConfig(): ListenTogetherConfig {
        val response = apiCall("读取一起听配置失败") {
            configApiService.getListenTogetherConfig()
        }
        if (!response.success || response.code != 0) {
            throw ListenTogetherApiException(response.code, response.msg.ifBlank { "读取一起听配置失败" })
        }
        return response.data
    }

    suspend fun createRoom(token: String, request: ListenTogetherCreateRoomRequest): ListenTogetherRoom {
        val response = apiCall("创建房间失败") {
            systemApiService.createListenTogetherRoom("Bearer $token", request)
        }
        return response.requireRoom("创建房间失败")
    }

    suspend fun getRoom(token: String, roomId: String): ListenTogetherRoom {
        val response = apiCall("查询房间失败") {
            systemApiService.getListenTogetherRoom("Bearer $token", roomId)
        }
        return response.requireRoom("查询房间失败")
    }

    private suspend fun <T> apiCall(fallback: String, block: suspend () -> T): T {
        return try {
            block()
        } catch (e: HttpException) {
            val error = e.response()?.errorBody()?.string().orEmpty()
            val parsed = runCatching { JSONObject(error) }.getOrNull()
            throw ListenTogetherApiException(
                apiCode = parsed?.optInt("code", e.code()) ?: e.code(),
                message = parsed?.optString("msg").orEmpty().ifBlank { e.message().ifBlank { fallback } },
                errorMsg = parsed?.optString("errorMsg").orEmpty().ifBlank { null },
            )
        }
    }

    private fun ListenTogetherRoomResponse.requireRoom(fallback: String): ListenTogetherRoom {
        if (!success || code != 0) {
            throw ListenTogetherApiException(code, msg.ifBlank { fallback }, errorMsg)
        }
        return data?.room ?: throw ListenTogetherApiException(code, fallback, errorMsg)
    }
}
