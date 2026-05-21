package cn.partialy.pm.network.repository

import cn.partialy.pm.model.HotSearchResponse
import cn.partialy.pm.model.KgPlaylistDetailApiResponse
import cn.partialy.pm.model.KgPlaylistTrackAllApiResponse
import cn.partialy.pm.model.KgPlaylistTagParent
import cn.partialy.pm.model.NewSongResponse
import cn.partialy.pm.model.HomeRecommendPlaylist
import cn.partialy.pm.model.RecommendSongResponse
import cn.partialy.pm.model.TopPlaylistSpecialItem
import cn.partialy.pm.model.TopCardData
import cn.partialy.pm.model.SearchPlaylistInfo
import cn.partialy.pm.model.SearchPlaylistResponse
import cn.partialy.pm.model.SearchSongResponse
import cn.partialy.pm.model.KgSongUrlResponse
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.pickKgStreamUrl
import cn.partialy.pm.lyric.LyricFormat
import cn.partialy.pm.lyric.LyricParser
import cn.partialy.pm.lyric.RawLyric
import cn.partialy.pm.network.api.KgApiService
import cn.partialy.pm.network.kg.DfidHolder
import cn.partialy.pm.network.kg.KgUrlProxyApiService
import cn.partialy.pm.network.cache.Cache
import cn.partialy.pm.network.config.ConfigManager
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KgRepository @Inject constructor(
    private val api: KgApiService,
    private val urlProxyApi: KgUrlProxyApiService,
    private val configManager: ConfigManager,
    private val dfidHolder: DfidHolder,
) {
    data class TopPlaylistPageResult(
        val list: List<HomeRecommendPlaylist>,
        val hasNext: Boolean,
        val total: Int,
    )

    private val cache = Cache(timeout = 60 * 2000) // 2分钟缓存

    suspend fun updateUrl(){
        configManager.getLatestBaseUrl()
    }

    private suspend fun ensureKgDfid() {
        val existing = dfidHolder.dfid
        if (!existing.isNullOrBlank()) return
        val resp = api.registerDev()
        val d = resp.data?.dfid?.takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("register/dev: missing dfid")
        dfidHolder.dfid = d
    }

    suspend fun getRecommendSongs(): Result<RecommendSongResponse> {
        return try {
            val response = api.getRecommendSongs()
            Result.success(response.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTopCardSongs(cardId: Int): Result<TopCardData> {
        return try {
            val response = api.getTopCard(cardId = cardId)
            val data = response.data
            if (response.errorCode != 0 || response.status != 1 || data == null) {
                return Result.failure(
                    IllegalStateException("歌曲推荐卡片失败: cardId=$cardId status=${response.status} error=${response.errorCode}"),
                )
            }
            Result.success(data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** 首页推荐歌单：GET top/playlist?category_id=0 */
    suspend fun getRecommendPlaylists(): Result<List<HomeRecommendPlaylist>> {
        return getRecommendPlaylists(categoryId = 0, page = 1, pagesize = null)
    }

    suspend fun getRecommendPlaylists(
        categoryId: Int = 0,
        page: Int = 1,
        pagesize: Int? = null,
    ): Result<List<HomeRecommendPlaylist>> {
        return try {
            val response = api.getTopPlaylists(
                categoryId = categoryId,
                withsong = 0,
                page = page,
                pagesize = pagesize,
            )
            if (response.errorCode != 0 || response.status != 1 || response.data == null) {
                return Result.failure(
                    IllegalStateException("歌单推荐失败: status=${response.status} error=${response.errorCode}"),
                )
            }
            val raw = response.data.specialList.orEmpty()
                .map { it.toHomeRecommendPlaylist() }
                .filter { it.name.isNotBlank() }
            Result.success(raw)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getRecommendPlaylistsPage(
        categoryId: Int = 0,
        page: Int = 1,
    ): Result<TopPlaylistPageResult> {
        return try {
            val response = api.getTopPlaylists(
                categoryId = categoryId,
                withsong = 0,
                page = page,
                pagesize = null,
            )
            val data = response.data
            if (response.errorCode != 0 || response.status != 1 || data == null) {
                return Result.failure(
                    IllegalStateException("歌单推荐失败: status=${response.status} error=${response.errorCode}"),
                )
            }
            val list = data.specialList.orEmpty()
                .map { it.toHomeRecommendPlaylist() }
                .filter { it.name.isNotBlank() }
            Result.success(
                TopPlaylistPageResult(
                    list = list,
                    hasNext = data.hasNext == 1,
                    total = data.total,
                ),
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPlaylistTags(): Result<List<KgPlaylistTagParent>> {
        return try {
            val response = api.getPlaylistTags()
            if (response.status != 1 || response.errorCode != 0) {
                Result.failure(
                    IllegalStateException("歌单分类失败: status=${response.status} error=${response.errorCode}"),
                )
            } else {
                Result.success(
                    response.data.sortedBy { it.sort.toIntOrNull() ?: Int.MAX_VALUE },
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** 歌单详情：/playlist/detail?ids=...（可逗号分隔多个） */
    suspend fun getPlaylistDetail(ids: List<String>): Result<KgPlaylistDetailApiResponse> {
        val normalized = ids.map { it.trim() }.filter { it.isNotEmpty() }
        if (normalized.isEmpty()) {
            return Result.failure(IllegalArgumentException("ids is empty"))
        }
        return try {
            val resp = api.getPlaylistDetail(ids = normalized.joinToString(","))
            if (resp.status != 1 || resp.errorCode != 0) {
                Result.failure(IllegalStateException("playlist/detail failed: status=${resp.status} error=${resp.errorCode}"))
            } else {
                Result.success(resp)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** 歌单全部歌曲：/playlist/track/all?id=... */
    suspend fun getPlaylistTrackAll(
        id: String,
        page: Int = 1,
        pagesize: Int = 30,
    ): Result<KgPlaylistTrackAllApiResponse> {
        val pid = id.trim()
        if (pid.isEmpty()) return Result.failure(IllegalArgumentException("id is empty"))
        return try {
            val resp = api.getPlaylistTrackAll(id = pid, page = page, pagesize = pagesize)
            if (resp.status != 1 || resp.errorCode != 0) {
                Result.failure(IllegalStateException("playlist/track/all failed: status=${resp.status} error=${resp.errorCode}"))
            } else {
                Result.success(resp)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun normalizePlaylistCoverUrl(url: String): String = url.replace("{size}", "240")

    private fun TopPlaylistSpecialItem.toHomeRecommendPlaylist(): HomeRecommendPlaylist {
        val coverRaw = flexibleCover.ifBlank { imgUrl }.ifBlank { pic }
        val cover = if (coverRaw.isNotBlank()) normalizePlaylistCoverUrl(coverRaw) else ""
        val count = playCount.takeIf { it > 0 } ?: collectCount
        val title = specialName.ifBlank { show }
        val stableId = globalCollectionId.ifBlank {
            "pl_${title.hashCode()}_${count}_${flexibleCover.hashCode()}"
        }
        return HomeRecommendPlaylist(
            id = stableId,
            name = title,
            coverUrl = cover,
            playCountLabel = formatKgPlayCount(count),
        )
    }

    private fun formatKgPlayCount(n: Long): String {
        if (n <= 0) return "—"
        return when {
            n >= 100_000_000 -> String.format(Locale.CHINA, "%.1f亿播放", n / 100_000_000.0)
            n >= 10_000 -> String.format(Locale.CHINA, "%.1f万播放", n / 10_000.0)
            else -> String.format(Locale.CHINA, "%d播放", n)
        }
    }

    suspend fun searchSong(
        keyword: String,
        page: Int = 1,
        pagesize: Int = 20
    ): Result<SearchSongResponse> {
        return try {
            ensureKgDfid()
            val cacheKey = "searchSong_${keyword}_${page}_${pagesize}"
            cache.get<SearchSongResponse>(cacheKey)?.let {
                return Result.success(it)
            }

            val response = api.searchSong(keyword, page, pagesize)
            cache.set(cacheKey, response.data)
            Result.success(response.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun searchPlaylist(
        keyword: String,
        page: Int = 1,
        pagesize: Int = 20,
    ): Result<SearchPlaylistResponse> {
        return try {
            ensureKgDfid()
            val response = api.searchPlaylist(
                keyword = keyword,
                page = page,
                pagesize = pagesize,
                type = "special",
            )
            val data = response.data
            val mapped = data.lists.map { item ->
                val cover = normalizePlaylistCoverUrl(item.img)
                val includeName = item.contain.substringBefore("、")
                    .substringBefore("/")
                    .trim()
                val id = when {
                    item.gid.isNotBlank() -> item.gid
                    item.specialId > 0 -> "collection_${item.specialId}"
                    else -> ""
                }
                SearchPlaylistInfo(
                    id = id,
                    name = item.specialName,
                    coverUrl = cover,
                    songCount = item.songCount,
                    includeSongName = includeName,
                    playCount = parsePlayCount(item.totalPlayCount, item.playCount),
                    source = SongType.KG,
                )
            }.filter { it.id.isNotBlank() && it.name.isNotBlank() }
            Result.success(
                SearchPlaylistResponse(
                    lists = mapped,
                    page = data.page,
                    pagesize = data.pagesize,
                    total = data.total,
                ),
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun parsePlayCount(primary: String, fallback: String): Long {
        val p = primary.trim().toLongOrNull()
        if (p != null && p > 0L) return p
        val f = fallback.trim().toLongOrNull()
        return if (f != null && f > 0L) f else 0L
    }

    suspend fun getSongUrl(hash: String, quality: String = "128"): Result<KgSongUrlResponse> {
        return try {
            ensureKgDfid()
            val response = urlProxyApi.getSongUrl(
                url = configManager.getKgSongUrl(),
                hash = hash,
                quality = quality,
            )
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDownloadUrl(songInfo: SongInfo,quality:String = "128"):Map<String,String> {
        return try {
            var url = ""
            var extName = ""
            val response = getSongUrl(songInfo.id, quality)
            response.onSuccess { res ->
                if (res.failProcess?.isNotEmpty() == true && res.failProcess.contains("buy")) {
                    return buildMap {
                        put("url","buy")
                    }
                }
                url = res.pickKgStreamUrl().orEmpty()
                extName = res.extName ?: "mp3"
            }
            buildMap {
                put("url", url)
                put("songName", songInfo.artist + " - " + songInfo.name + "." + extName)
            }
        } catch (e: Exception) {
            println("获取链接失败：$e")
            buildMap {
                put("url", "error")
                put("songName","error")
            }
        }
    }

    suspend fun getBestLyric(hash: String): Result<RawLyric> {
        return try {
            ensureKgDfid()
            val response = api.searchLyric(hash)
            val c = response.candidates.firstOrNull()
                ?: return Result.failure(IllegalStateException("search/lyric: no candidates"))
            requestBestLyric(c.id, c.accesskey)
        }catch (e:Exception){
            Result.failure(e)
        }
    }

    suspend fun getLyric(hash: String):Result<String> =
        getBestLyric(hash).map { it.text }

    suspend fun getLyricByKeywords(keywords: String): Result<String> {
        return getBestLyricByKeywords(keywords).map { it.text }
    }

    suspend fun getBestLyricByKeywords(keywords: String): Result<RawLyric> {
        val kw = keywords.trim()
        if (kw.isEmpty()) return Result.success(RawLyric("", LyricFormat.NONE, "network_kg_empty"))
        return try {
            ensureKgDfid()
            val cacheKey = "kg_lyric_kw_$kw"
            cache.get<RawLyric>(cacheKey)?.let { return Result.success(it) }
            val response = api.searchLyricByKeywords(kw)
            val c = response.candidates.firstOrNull()
                ?: return Result.success(RawLyric("", LyricFormat.NONE, "network_kg_empty"))
            val result = requestBestLyric(c.id, c.accesskey).getOrThrow()
            if (result.text.isNotEmpty()) cache.set(cacheKey, result)
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun requestBestLyric(id: String, accesskey: String): Result<RawLyric> {
        val krc = requestLyric(id, accesskey, LyricFormat.KRC, "krc", "network_kg_krc")
        if (krc != null && LyricParser.parseContent(krc).hasWordTiming) return Result.success(krc)

        val lrc = requestLyric(id, accesskey, LyricFormat.LRC, "lrc", "network_kg_lrc")
        return if (lrc != null && LyricParser.parseContent(lrc).hasLyrics) {
            Result.success(lrc)
        } else {
            Result.success(RawLyric("", LyricFormat.NONE, "network_kg_empty"))
        }
    }

    private suspend fun requestLyric(
        id: String,
        accesskey: String,
        format: LyricFormat,
        fmt: String,
        source: String,
    ): RawLyric? {
        return runCatching {
            val lyric = api.getLyric(
                id = id,
                accesskey = accesskey,
                fmt = fmt,
                decode = true,
            )
            lyric.decodeContent.orEmpty().trim()
                .takeIf { it.isNotBlank() }
                ?.let { RawLyric(it, format, source) }
        }.getOrNull()
    }

    suspend fun getHotSongs(): Result<HotSearchResponse> {
        return try {
            val cacheKey = "hotSongs"
            cache.get<HotSearchResponse>(cacheKey)?.let {
                return Result.success(it)
            }
            val response = api.getHotSongs()
            val data = response.data
            cache.set(cacheKey, data)
            Result.success(data)

        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getNewSongs(): Result<NewSongResponse> {
        return try {
            val cacheKey = "newSongs"
            cache.get<NewSongResponse>(cacheKey)?.let {
                return Result.success(it)
            }

            val response = api.getNewSongs()
            val data = response.data
            cache.set(cacheKey, data)
            Result.success(data)

        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getLinkKeyword(keywords: String): Result<SearchSongResponse> {
        return try {
            ensureKgDfid()
            val response = api.getLinkKeyword(keywords)
            Result.success(response.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
