package cn.partialy.pm.network.wy

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SearchPlaylistInfo
import cn.partialy.pm.model.SearchPlaylistResponse
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.cache.Cache
import cn.partialy.pm.network.config.ConfigManager
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WyRepository @Inject constructor(
    private val api: WyApiService,
    private val urlProxy: WyUrlProxyApiService,
    private val configManager: ConfigManager,
) {
    private val cache = Cache(timeout = 2 * 60 * 1000)

    suspend fun cloudSearch(
        keywords: String,
        limit: Int? = null,
        offset: Int? = null,
    ): Result<List<WySongDto>> {
        return try {
            val cacheKey = "wy_cloud_${keywords}_${limit}_$offset"
            cache.get<List<WySongDto>>(cacheKey)?.let { return Result.success(it) }
            val body = api.cloudSearch(keywords, limit, offset, type = null)
            val songs = body.result?.songs.orEmpty()
            cache.set(cacheKey, songs)
            Result.success(songs)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun cloudSearchPlaylist(
        keywords: String,
        limit: Int? = null,
        offset: Int? = null,
    ): Result<SearchPlaylistResponse> {
        return try {
            val cacheKey = "wy_cloud_playlist_${keywords}_${limit}_$offset"
            cache.get<SearchPlaylistResponse>(cacheKey)?.let { return Result.success(it) }
            val body = api.cloudSearch(keywords, limit, offset, type = 1000)
            val result = body.result
            val playlists = result?.playlists.orEmpty().mapNotNull { dto ->
                val id = dto.id.toString()
                if (id.isBlank() || dto.name.isBlank()) return@mapNotNull null
                SearchPlaylistInfo(
                    id = id,
                    name = dto.name,
                    coverUrl = dto.coverImgUrl,
                    songCount = dto.trackCount,
                    includeSongName = dto.creator?.nickname.orEmpty(),
                    playCount = dto.playCount,
                    source = SongType.WY,
                )
            }
            val mapped = SearchPlaylistResponse(
                lists = playlists,
                page = ((offset ?: 0) / (limit ?: 30)) + 1,
                pagesize = limit ?: 30,
                total = result?.playlistCount ?: playlists.size,
            )
            cache.set(cacheKey, mapped)
            Result.success(mapped)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getSongUrl(id: String, br: Int? = null): Result<WySongUrlResponse> {
        return try {
            val cacheKey = "wy_url_${id}_$br"
            cache.get<WySongUrlResponse>(cacheKey)?.let { return Result.success(it) }
            val body = urlProxy.songUrl(configManager.getWySongUrl(), id, br)
            cache.set(cacheKey, body)
            Result.success(body)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getSongUrlV1(id: String, level: String): Result<WySongUrlResponse> {
        return try {
            val numericId = id.toLongOrNull()
                ?: return Result.failure(IllegalArgumentException("wy songUrlV1: invalid id $id"))
            val cacheKey = "wy_url_v1_${id}_$level"
            cache.get<WySongUrlResponse>(cacheKey)?.let { return Result.success(it) }
            val body = urlProxy.songUrlV1(configManager.getWySongUrlV1(), numericId, level)
            cache.set(cacheKey, body)
            Result.success(body)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getSongDownloadUrl(id: String, br: Int? = null): Result<WySongUrlResponse> {
        return try {
            val numericId = id.toLongOrNull()
                ?: return Result.failure(IllegalArgumentException("wy songDownloadUrl: invalid id $id"))
            val cacheKey = "wy_dl_${id}_$br"
            cache.get<WySongUrlResponse>(cacheKey)?.let { return Result.success(it) }
            val body = urlProxy.songDownloadUrl(numericId, br)
            cache.set(cacheKey, body)
            Result.success(body)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getLyric(id: Long): Result<String> {
        return try {
            val cacheKey = "wy_lyric_$id"
            cache.get<String>(cacheKey)?.let { return Result.success(it) }
            val body = api.lyric(id)
            val text = body.lrc?.lyric.orEmpty()
            if (text.isNotEmpty()) cache.set(cacheKey, text)
            Result.success(text)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** song/url + br（与 pmNative 下载解析一致） */
    suspend fun getDownloadUrlWithBr(songInfo: SongInfo, br: Int): Map<String, String> {
        return try {
            val res = getSongUrl(songInfo.id, br).getOrNull() ?: return wyDownloadErrorMap()
            val url = res.pickFirstWyStreamUrl().orEmpty()
            if (url.isEmpty()) return wyDownloadErrorMap()
            wySuccessMap(songInfo, url, "mp3")
        } catch (e: Exception) {
            wyDownloadErrorMap()
        }
    }

    /** song/url/v1 + level */
    suspend fun getDownloadUrlWithLevel(songInfo: SongInfo, level: String): Map<String, String> {
        return try {
            val res = getSongUrlV1(songInfo.id, level).getOrNull() ?: return wyDownloadErrorMap()
            val url = res.pickFirstWyStreamUrl().orEmpty()
            if (url.isEmpty()) return wyDownloadErrorMap()
            val ext = wyExtForLevel(level)
            wySuccessMap(songInfo, url, ext)
        } catch (e: Exception) {
            wyDownloadErrorMap()
        }
    }
}

private fun WySongUrlResponse.pickFirstWyStreamUrl(): String? =
    data.asSequence()
        .mapNotNull { it.url?.takeIf { u -> u.startsWith("http") } }
        .firstOrNull()

private fun wyDownloadErrorMap(): Map<String, String> =
    mapOf("url" to "error", "songName" to "error")

private fun wySuccessMap(songInfo: SongInfo, url: String, ext: String): Map<String, String> =
    mapOf(
        "url" to url,
        "songName" to "${songInfo.artist} - ${songInfo.name}.$ext",
    )

private fun wyExtForLevel(level: String): String =
    when (level.lowercase()) {
        "lossless", "hires", "jymaster" -> "flac"
        else -> "mp3"
    }
