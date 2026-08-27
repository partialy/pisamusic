package cn.partialy.pm.listen

import android.content.Context
import cn.partialy.pm.R
import cn.partialy.pm.network.api.SystemApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import org.json.JSONObject
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ListenTogetherRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val systemApiService: SystemApiService,
    private val configApiService: ListenTogetherConfigApiService,
) {
    suspend fun getConfig(): ListenTogetherConfig {
        val fallback = context.getString(R.string.listen_together_config_load_failed)
        val response = apiCall(fallback) {
            configApiService.getListenTogetherConfig()
        }
        if (!response.success || response.code != 0) {
            throw ListenTogetherApiException(response.code, response.msg.ifBlank { fallback })
        }
        return response.data
    }

    suspend fun createRoom(token: String, request: ListenTogetherCreateRoomRequest): ListenTogetherRoom {
        val fallback = context.getString(R.string.listen_together_create_failed)
        val response = apiCall(fallback) {
            systemApiService.createListenTogetherRoom("Bearer $token", request)
        }
        return response.requireRoom(fallback)
    }

    suspend fun getRoom(token: String, roomId: String): ListenTogetherRoom {
        val fallback = context.getString(R.string.listen_together_query_failed)
        val response = apiCall(fallback) {
            systemApiService.getListenTogetherRoom("Bearer $token", roomId)
        }
        return response.requireRoom(fallback)
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
