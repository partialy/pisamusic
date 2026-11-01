package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.activity.toSongInfoOrNull
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.network.cookie.model.toSongInfoOrNull
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.ui.mine.playlistSongKey
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class OnlinePlaylistLoadState(
    val songs: List<SongInfo>,
    val complete: Boolean = false,
    val failed: Boolean = false,
)

/** 按 API 原始行数推进游标，不能以过滤后的歌曲数判断分页终点。 */
class OnlinePlaylistBatchTrackLoader @Inject constructor(
    private val kgRepository: KgRepository,
    private val wyRepository: WyCookieRepository,
) {
    suspend fun load(
        source: SongType,
        playlistId: String,
        totalHint: Int,
        initial: List<SongInfo>,
        publish: suspend (OnlinePlaylistLoadState) -> Unit,
    ) = withContext(Dispatchers.IO) {
        val loaded = linkedMapOf<String, SongInfo>()
        val seed = initial.associateBy(::playlistSongKey)
        var offset = 0
        var page = 1
        var total = totalHint
        try {
            while (true) {
                ensureActive()
                // KG 页码随 pagesize 变化会产生缺页，因此本次加载固定每页 30 条。
                val songs: List<SongInfo>
                val rawSize: Int
                when (source) {
                    SongType.KG -> {
                        val response = kgRepository.getPlaylistTrackAll(playlistId, page, PAGE_SIZE).getOrThrow().data
                            ?: error("Missing playlist data")
                        total = response.count
                        rawSize = response.info.size
                        songs = response.info.mapNotNull { it.toSongInfoOrNull() }
                    }
                    SongType.WY -> {
                        val response = wyRepository.getPlaylistTrackAll(playlistId, PAGE_SIZE, offset).getOrThrow()
                        check(response.code == null || response.code == 200)
                        rawSize = response.songs.orEmpty().size
                        songs = response.songs.orEmpty().mapNotNull { it.toSongInfoOrNull() }
                    }
                    else -> error("Unsupported playlist source")
                }
                val previousSize = loaded.size
                songs.forEach { loaded[playlistSongKey(it)] = it }
                offset += rawSize
                // WY 的 totalHint 可能来自陈旧收藏快照，只能继续取到真实终页。
                val outcome = onlinePlaylistPageOutcome(total, offset, rawSize, loaded.size - previousSize,
                    PAGE_SIZE, totalIsAuthoritative = source == SongType.KG)
                check(outcome != OnlinePlaylistPageOutcome.FAILED) { "Incomplete playlist page" }
                if (outcome == OnlinePlaylistPageOutcome.COMPLETE) {
                    publish(OnlinePlaylistLoadState(loaded.values.toList(), complete = true))
                    return@withContext
                }
                publish(OnlinePlaylistLoadState((loaded + seed.filterKeys { it !in loaded }).values.toList()))
                page++
            }
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            publish(OnlinePlaylistLoadState((loaded + seed.filterKeys { it !in loaded }).values.toList(), failed = true))
        }
    }

    private companion object { const val PAGE_SIZE = 30 }
}
