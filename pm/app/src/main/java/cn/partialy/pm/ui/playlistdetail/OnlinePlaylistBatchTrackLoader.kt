package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.activity.toSongInfoOrNull
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.network.cookie.model.toSongInfoOrNull
import cn.partialy.pm.network.repository.KgRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.security.MessageDigest
import javax.inject.Inject

data class OnlinePlaylistLoadState(
    val songs: List<SongInfo>,
    val complete: Boolean = false,
    val failed: Boolean = false,
    val readCount: Int = 0,
    val skippedCount: Int = 0,
)

/** 按原始行游标重新读取；初始快照只补充加载中展示及已知 playable=false。 */
class OnlinePlaylistBatchTrackLoader @Inject constructor(
    private val kgRepository: KgRepository,
    private val wyRepository: WyCookieRepository,
) {
    @Suppress("UNUSED_PARAMETER")
    suspend fun load(
        source: SongType,
        playlistId: String,
        totalHint: Int,
        initial: List<SongInfo>,
        publish: suspend (OnlinePlaylistLoadState) -> Unit,
    ) = withContext(Dispatchers.IO) {
        val accumulator = OnlinePlaylistTrackAccumulator(initial)
        val fingerprints = hashSetOf<String>()
        var offset = 0
        var page = 1
        var total = -1
        fun snapshot(complete: Boolean = false, failed: Boolean = false) = OnlinePlaylistLoadState(
            if (complete) accumulator.songs() else accumulator.partialWithSeed(),
            complete, failed, offset, accumulator.skippedCount,
        )
        try {
            val wyMembership = if (source == SongType.WY) withTimeout(60000) {
                wyRepository.getPlaylistDetailAuthority(playlistId).getOrThrow()
                    .requireCompleteMembership(playlistId)
            } else null
            if (wyMembership != null) total = wyMembership.size
            while (true) {
                ensureActive()
                check(page <= 10000) { "Playlist pagination limit" }
                val rows: List<SongInfo?>
                val rawSize: Int
                val fingerprint: String
                when (source) {
                    SongType.KG -> {
                        val response = withTimeout(60000) {
                            kgRepository.getPlaylistTrackAll(playlistId, page, PAGE_SIZE).getOrThrow().data
                        } ?: error("Missing playlist data")
                        check(response.count >= 0) { "Missing authoritative total" }
                        if (total >= 0) check(total == response.count) { "Playlist changed during pagination" }
                        total = response.count
                        val raw = response.info ?: error("Missing playlist rows")
                        rawSize = raw.size
                        fingerprint = fingerprint(raw)
                        rows = raw.map { it.toSongInfoOrNull() }
                    }
                    SongType.WY -> {
                        val response = withTimeout(60000) {
                            wyRepository.getPlaylistTrackAll(playlistId, PAGE_SIZE, offset).getOrThrow()
                        }
                        check(response.code == 200) { "Missing successful playlist response" }
                        val raw = response.songs ?: error("Missing playlist songs")
                        check(matchesPlaylistMembershipPage(wyMembership ?: error("Missing authority"),
                            offset, raw.map { it.id })) { "Playlist membership mismatch" }
                        rawSize = raw.size
                        fingerprint = fingerprint(raw)
                        rows = raw.map { row ->
                            if ((row.id ?: 0) <= 0) null else {
                                // 名称为空仍是有效 ID，不能因为展示校验丢失歌曲。
                                row.toSongInfoOrNull(allowBlankName = true)
                            }
                        }
                    }
                    else -> error("Unsupported playlist source")
                }
                val repeated = rawSize > 0 && !fingerprints.add(fingerprint)
                val nextOffset = offset + rawSize
                val outcome = onlinePlaylistPageOutcome(total, nextOffset, rawSize, PAGE_SIZE,
                    totalIsAuthoritative = true, repeatedPage = repeated)
                check(outcome != OnlinePlaylistPageOutcome.FAILED) { "Incomplete playlist page" }
                accumulator.append(rows)
                offset = nextOffset
                if (outcome == OnlinePlaylistPageOutcome.COMPLETE) {
                    publish(snapshot(complete = true))
                    return@withContext
                }
                publish(snapshot())
                page++
            }
        } catch (_: TimeoutCancellationException) {
            publish(snapshot(failed = true))
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            publish(snapshot(failed = true))
        }
    }

    private fun fingerprint(rows: List<*>): String = MessageDigest.getInstance("SHA-256")
        .digest(rows.toString().toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

    private companion object { const val PAGE_SIZE = 30 }
}
