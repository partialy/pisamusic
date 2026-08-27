package cn.partialy.pm.share

import android.content.Context
import cn.partialy.pm.R
import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.CanonicalSong
import cn.partialy.pm.network.api.SystemApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import org.json.JSONObject
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ShareRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val systemApiService: SystemApiService,
) {
    suspend fun createSongShare(token: String, song: CanonicalSong): ShareCreateData {
        val fallback = context.getString(R.string.share_song_create_failed)
        val response = apiCall(fallback) {
            systemApiService.createShare("Bearer $token", song.toShareCreateRequest())
        }
        return response.requireData(fallback)
    }

    suspend fun createPlaylistShare(token: String, playlist: CanonicalPlaylist): ShareCreateData {
        val fallback = context.getString(R.string.share_playlist_create_failed)
        val response = apiCall(fallback) {
            systemApiService.createShare("Bearer $token", playlist.toShareCreateRequest())
        }
        return response.requireData(fallback)
    }

    suspend fun getPublicShare(uuid: String): SharePublicData {
        val fallback = context.getString(R.string.share_read_failed)
        val response = apiCall(fallback) {
            systemApiService.getPublicShare(uuid)
        }
        if (!response.success || response.code != 0) {
            throw ShareApiException(response.code, response.msg.ifBlank { fallback })
        }
        return response.data ?: throw ShareApiException(
            response.code,
            context.getString(R.string.share_missing_or_expired),
        )
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
