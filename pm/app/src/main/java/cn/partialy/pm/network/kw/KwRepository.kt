package cn.partialy.pm.network.kw

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.network.cache.Cache
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KwRepository @Inject constructor(
    private val searchApi: KwSearchApiService,
    private val urlProxyApi: KwUrlProxyApiService,
) {
    private val cache = Cache(timeout = 2 * 60 * 1000)

    suspend fun search(keywords: String, page: Int = 1): Result<List<KwSearchItem>> {
        return try {
            val cacheKey = "kw_search_${keywords}_$page"
            cache.get<List<KwSearchItem>>(cacheKey)?.let { return Result.success(it) }
            val body = searchApi.search(keywords, page)
            val list = body.data.orEmpty()
            cache.set(cacheKey, list)
            Result.success(list)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPlayUrl(id: Long, quality: String = "standard"): Result<KwUrlResponse> {
        return try {
            val cacheKey = "kw_url_${id}_$quality"
            cache.get<KwUrlResponse>(cacheKey)?.let { return Result.success(it) }
            val body = urlProxyApi.getPlayUrl(id, quality)
            cache.set(cacheKey, body)
            Result.success(body)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDownloadUrl(songInfo: SongInfo, quality: String): Map<String, String> {
        return try {
            val id = songInfo.id.toLongOrNull()
                ?: return mapOf("url" to "error", "songName" to "error")
            val res = getPlayUrl(id, quality).getOrNull()
                ?: return mapOf("url" to "error", "songName" to "error")
            val url = res.pickUrl().orEmpty()
            if (!url.startsWith("http")) return mapOf("url" to "error", "songName" to "error")
            val ext = if (quality.equals("lossless", ignoreCase = true)) "flac" else "mp3"
            mapOf(
                "url" to url,
                "songName" to "${songInfo.artist} - ${songInfo.name}.$ext",
            )
        } catch (e: Exception) {
            mapOf("url" to "error", "songName" to "error")
        }
    }
}
