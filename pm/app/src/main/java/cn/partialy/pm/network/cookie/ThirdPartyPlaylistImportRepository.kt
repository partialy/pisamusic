package cn.partialy.pm.network.cookie

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

sealed class ThirdPartyPullOutcome {
    abstract val snapshot: ThirdPartyCandidateSnapshot

    data class NoLogin(
        override val snapshot: ThirdPartyCandidateSnapshot,
    ) : ThirdPartyPullOutcome()

    data class Success(
        override val snapshot: ThirdPartyCandidateSnapshot,
        val succeededSources: List<String>,
    ) : ThirdPartyPullOutcome()

    data class PartialFailure(
        override val snapshot: ThirdPartyCandidateSnapshot,
        val succeededSources: List<String>,
        val failedSources: List<String>,
    ) : ThirdPartyPullOutcome()

    data class AllFailed(
        override val snapshot: ThirdPartyCandidateSnapshot,
        val failedSources: List<String>,
        val errorMessage: String?,
    ) : ThirdPartyPullOutcome()
}

/**
 * 三方平台（KG/WY）歌单候选拉取与缓存协调器。
 */
@Singleton
class ThirdPartyPlaylistImportRepository @Inject constructor(
    private val musicCookieManager: MusicCookieManager,
    private val kugouCookieRepository: KugouCookieRepository,
    private val wyCookieRepository: WyCookieRepository,
    private val candidateStore: ThirdPartyPlaylistCandidateStore,
) {
    fun loggedInSources(): List<String> =
        listOf(MusicCookieManager.SOURCE_KG, MusicCookieManager.SOURCE_WY)
            .filter { musicCookieManager.getCookie(it).exist }

    fun hasAnyThirdPartyLogin(): Boolean = loggedInSources().isNotEmpty()

    suspend fun readSnapshot(): ThirdPartyCandidateSnapshot = withContext(Dispatchers.IO) {
        candidateStore.getAll()
    }

    suspend fun pullCandidates(
        targetSources: List<String> = loggedInSources(),
    ): ThirdPartyPullOutcome = withContext(Dispatchers.IO) {
        val sources = targetSources.distinct().filter {
            (it == MusicCookieManager.SOURCE_KG || it == MusicCookieManager.SOURCE_WY) &&
                musicCookieManager.getCookie(it).exist
        }
        if (sources.isEmpty()) {
            return@withContext ThirdPartyPullOutcome.NoLogin(candidateStore.getAll())
        }

        val results = coroutineScope {
            sources.map { source ->
                async {
                    source to runCatching {
                        when (source) {
                            MusicCookieManager.SOURCE_KG -> fetchKgCandidates()
                            MusicCookieManager.SOURCE_WY -> fetchWyCandidates()
                            else -> emptyList()
                        }
                    }.onFailure { if (it is CancellationException) throw it }
                }
            }.awaitAll()
        }

        val succeeded = ArrayList<String>()
        val failed = ArrayList<String>()
        var firstError: String? = null
        val now = System.currentTimeMillis()
        for ((source, result) in results) {
            result.fold(
                onSuccess = { items ->
                    candidateStore.replaceSource(source, items, now)
                    succeeded.add(source)
                },
                onFailure = { err ->
                    failed.add(source)
                    if (firstError == null) {
                        firstError = err.message
                    }
                },
            )
        }

        val snapshot = candidateStore.getAll()
        when {
            failed.isEmpty() -> ThirdPartyPullOutcome.Success(snapshot, succeeded)
            succeeded.isNotEmpty() -> ThirdPartyPullOutcome.PartialFailure(snapshot, succeeded, failed)
            else -> ThirdPartyPullOutcome.AllFailed(snapshot, failed, firstError)
        }
    }

    private suspend fun fetchKgCandidates(): List<ThirdPartyPlaylistCandidate> {
        val items = kugouCookieRepository.fetchAllUserPlaylists().getOrThrow()
        val now = System.currentTimeMillis()
        val seenIds = HashSet<String>()
        val out = ArrayList<ThirdPartyPlaylistCandidate>(items.size)
        for (item in items) {
            val id = item.globalCollectionId?.takeIf { it.isNotBlank() }
                ?: item.listid?.takeIf { it > 0 }?.toString()
                ?: continue
            val name = item.name?.trim()?.takeIf { it.isNotEmpty() } ?: continue
            if (!seenIds.add(id)) continue
            val rawCover = item.pic?.takeIf { it.isNotBlank() }
                ?: item.createUserPic?.takeIf { it.isNotBlank() }
                ?: ""
            out.add(
                ThirdPartyPlaylistCandidate(
                    source = MusicCookieManager.SOURCE_KG,
                    id = id,
                    name = name,
                    intro = "",
                    cover = rawCover,
                    songCount = item.count ?: 0,
                    updatedAt = now,
                ),
            )
        }
        return out
    }

    private suspend fun fetchWyCandidates(): List<ThirdPartyPlaylistCandidate> {
        val uid = wyCookieRepository.getProfile()?.userId?.toLongOrNull()
            ?: run {
                val account = wyCookieRepository.getAccount().getOrThrow()
                wyCookieRepository.resolveUid(account)
            }
            ?: error("网易云账号信息缺失")
        val items = wyCookieRepository.fetchAllUserPlaylists(uid).getOrThrow()
        val now = System.currentTimeMillis()
        val seenIds = HashSet<String>()
        val out = ArrayList<ThirdPartyPlaylistCandidate>(items.size)
        for (item in items) {
            val id = item.id?.takeIf { it > 0 }?.toString() ?: continue
            val name = item.name?.trim()?.takeIf { it.isNotEmpty() } ?: continue
            if (!seenIds.add(id)) continue
            out.add(
                ThirdPartyPlaylistCandidate(
                    source = MusicCookieManager.SOURCE_WY,
                    id = id,
                    name = name,
                    intro = item.description?.trim().orEmpty(),
                    cover = item.coverImgUrl?.trim().orEmpty(),
                    songCount = item.trackCount ?: 0,
                    updatedAt = now,
                ),
            )
        }
        return out
    }
}
