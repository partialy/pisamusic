package cn.partialy.pm.network.wy

import cn.partialy.pm.lyric.LyricFormat
import cn.partialy.pm.lyric.LyricParser
import cn.partialy.pm.lyric.RawLyric
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.HomeRecommendPlaylist
import cn.partialy.pm.model.RecommendSongInfo
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SearchPlaylistInfo
import cn.partialy.pm.model.SearchPlaylistResponse
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.cache.Cache
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.network.cookie.WyCookieRepository
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WyRepository @Inject constructor(
    private val api: WyApiService,
    private val urlProxy: WyUrlProxyApiService,
    private val configManager: ConfigManager,
    private val cookieRepository: WyCookieRepository,
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
            val body = cookieFirst(
                operationName = "wy cloudSearch",
                cookieCall = { cookieRepository.cloudSearch(keywords, limit, offset, type = null) },
                isValid = { it.code == null || it.code == 200 },
                anonymousCall = { api.cloudSearch(keywords, limit, offset, type = null) },
            )
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
            val body = cookieFirst(
                operationName = "wy cloudSearch playlist",
                cookieCall = { cookieRepository.cloudSearch(keywords, limit, offset, type = 1000) },
                isValid = { it.code == null || it.code == 200 },
                anonymousCall = { api.cloudSearch(keywords, limit, offset, type = 1000) },
            )
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

    suspend fun getRecommendPlaylists(limit: Int = 30): Result<List<HomeRecommendPlaylist>> {
        return try {
            val cacheKey = "wy_personalized_playlists_$limit"
            cache.get<List<HomeRecommendPlaylist>>(cacheKey)?.let { return Result.success(it) }
            val body = cookieFirst(
                operationName = "wy personalized",
                cookieCall = { cookieRepository.personalizedPlaylists(limit = limit) },
                isValid = { it.code == 200 },
                anonymousCall = { api.personalizedPlaylists(limit = limit) },
            )
            if (body.code != 200) {
                return Result.failure(IllegalStateException("wy personalized failed: code=${body.code}"))
            }
            val playlists = body.result.mapNotNull { it.toHomeRecommendPlaylistOrNull() }
            cache.set(cacheKey, playlists)
            Result.success(playlists)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getRecommendNewSongs(limit: Int = 30): Result<List<RecommendSongInfo>> {
        return try {
            val cacheKey = "wy_personalized_newsongs_$limit"
            cache.get<List<RecommendSongInfo>>(cacheKey)?.let { return Result.success(it) }
            val body = cookieFirst(
                operationName = "wy personalized/newsong",
                cookieCall = { cookieRepository.personalizedNewSongs(limit = limit) },
                isValid = { it.code == 200 },
                anonymousCall = { api.personalizedNewSongs(limit = limit) },
            )
            if (body.code != 200) {
                return Result.failure(IllegalStateException("wy personalized/newsong failed: code=${body.code}"))
            }
            val songs = body.result.mapNotNull { it.toRecommendSongInfoOrNull() }
            cache.set(cacheKey, songs)
            Result.success(songs)
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
        return getBestLyric(id).map { it.text }
    }

    suspend fun getBestLyric(id: Long): Result<RawLyric> {
        return try {
            val cacheKey = "wy_lyric_$id"
            cache.get<RawLyric>(cacheKey)?.let { return Result.success(it) }
            val body = cookieFirst(
                operationName = "wy lyric",
                cookieCall = { cookieRepository.lyric(id) },
                isValid = { it.code == null || it.code == 200 },
                anonymousCall = { api.lyric(id) },
            )
            val yrc = body.yrc?.lyric.orEmpty().trim()
                .takeIf { it.isNotBlank() }
                ?.let { RawLyric(it, LyricFormat.YRC, "network_wy_yrc") }
            if (yrc != null && LyricParser.parseContent(yrc).hasWordTiming) {
                cache.set(cacheKey, yrc)
                return Result.success(yrc)
            }

            val lrc = body.lrc?.lyric.orEmpty().trim()
                .takeIf { it.isNotBlank() }
                ?.let { RawLyric(it, LyricFormat.LRC, "network_wy_lrc") }
            if (lrc != null && LyricParser.parseContent(lrc).hasLyrics) {
                cache.set(cacheKey, lrc)
                return Result.success(lrc)
            }

            Result.success(RawLyric("", LyricFormat.NONE, "network_wy_empty"))
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

    private suspend fun <T> cookieFirst(
        operationName: String,
        cookieCall: suspend () -> Result<T>,
        isValid: (T) -> Boolean = { true },
        anonymousCall: suspend () -> T,
    ): T {
        if (cookieRepository.hasCookie()) {
            val result = runCatching { cookieCall() }
                .getOrElse { Result.failure(it) }
            result.fold(
                onSuccess = { value ->
                    if (isValid(value)) return value
                    println("Cookie 请求业务失败，回退匿名接口：$operationName")
                },
                onFailure = { e ->
                    println("Cookie 请求失败，回退匿名接口：$operationName ${e.message}")
                    e.printStackTrace()
                },
            )
        }
        return anonymousCall()
    }
}

private fun WyPersonalizedPlaylistDto.toHomeRecommendPlaylistOrNull(): HomeRecommendPlaylist? {
    if (id <= 0L || name.isBlank()) return null
    return HomeRecommendPlaylist(
        id = id.toString(),
        name = name,
        coverUrl = picUrl,
        playCountLabel = formatWyPlayCount(playCount),
        trackCount = trackCount,
        sourceType = CollectedPlaylistType.WY,
    )
}

private fun WyPersonalizedNewSongDto.toRecommendSongInfoOrNull(): RecommendSongInfo? {
    val rawSong = song
    val songId = (rawSong?.id ?: id).takeIf { it > 0L } ?: return null
    val title = rawSong?.name.orEmpty().ifBlank { name }
    if (title.isBlank()) return null
    val artists = rawSong?.artists.orEmpty()
        .map { it.name.trim() }
        .filter { it.isNotEmpty() }
        .joinToString("、")
    return RecommendSongInfo(
        songname = title,
        author_name = artists,
        hash = songId.toString(),
        sizable_cover = rawSong?.album?.picUrl.orEmpty().ifBlank { picUrl },
        sourceType = SongType.WY,
        albumName = rawSong?.album?.name?.takeIf { it.isNotBlank() },
        duration = rawSong?.duration?.let { (it / 1000).coerceAtLeast(0) },
    )
}

private fun formatWyPlayCount(n: Long): String {
    if (n <= 0L) return "播放"
    return when {
        n >= 100_000_000L -> String.format(Locale.CHINA, "%.1f亿播放", n / 100_000_000.0)
        n >= 10_000L -> String.format(Locale.CHINA, "%.1f万播放", n / 10_000.0)
        else -> String.format(Locale.CHINA, "%d播放", n)
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
