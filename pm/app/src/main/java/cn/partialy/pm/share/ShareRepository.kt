package cn.partialy.pm.share

import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.CanonicalSong
import cn.partialy.pm.network.api.SystemApiService
import org.json.JSONObject
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ShareRepository @Inject constructor(
    private val systemApiService: SystemApiService,
) {
    suspend fun createSongShare(token: String, song: CanonicalSong): ShareCreateData {
        val response = apiCall("创建歌曲分享失败") {
            systemApiService.createShare("Bearer $token", song.toShareCreateRequest())
        }
        return response.requireData("创建歌曲分享失败")
    }

    suspend fun createPlaylistShare(token: String, playlist: CanonicalPlaylist): ShareCreateData {
        val response = apiCall("创建歌单分享失败") {
            systemApiService.createShare("Bearer $token", playlist.toShareCreateRequest())
        }
        return response.requireData("创建歌单分享失败")
    }

    suspend fun getPublicShare(uuid: String): SharePublicData {
        val response = apiCall("读取分享失败") {
            systemApiService.getPublicShare(uuid)
        }
        if (!response.success || response.code != 0) {
            throw ShareApiException(response.code, response.msg.ifBlank { "读取分享失败" })
        }
        return response.data ?: throw ShareApiException(response.code, "分享不存在或已失效")
    }

    private suspend fun <T> apiCall(fallback: String, block: suspend () -> T): T {
        return try {
            block()
        } catch (e: HttpException) {
            val error = e.response()?.errorBody()?.string().orEmpty()
            val parsed = runCatching { JSONObject(error) }.getOrNull()
            throw ShareApiException(
                apiCode = parsed?.optInt("code", e.code()) ?: e.code(),
                message = parsed?.optString("msg").orEmpty().ifBlank { e.message().ifBlank { fallback } },
            )
        }
    }

    private fun ShareCreateResponse.requireData(fallback: String): ShareCreateData {
        if (!success || code != 0) {
            throw ShareApiException(code, msg.ifBlank { fallback })
        }
        return data ?: throw ShareApiException(code, fallback)
    }
}
