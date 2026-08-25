package cn.partialy.pm.player.cache

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Test

class ReadyPlaybackFallbackRulesTest {

    @Test
    fun `partial catalog row is rejected even when live snapshot looks ready`() {
        val candidate = candidate(
            qualityKey = CURRENT_QUALITY,
            status = PlaybackCacheStatus.PARTIAL,
            totalBytes = TOTAL_BYTES,
            cachedBytes = TOTAL_BYTES / 2,
        )

        assertEquals(emptyList<SongInfo>(), scan(candidate, readySnapshot()).songs)
    }

    @Test
    fun `stale ready row whose live snapshot became partial is rejected`() {
        val candidate = candidate(qualityKey = CURRENT_QUALITY)

        assertEquals(
            emptyList<SongInfo>(),
            scan(
                candidate,
                Media3CacheResourceSnapshot(
                    cacheKey = candidate.identity.cacheKey,
                    totalBytes = TOTAL_BYTES,
                    cachedBytes = TOTAL_BYTES / 2,
                    status = PlaybackCacheStatus.PARTIAL,
                ),
            ).songs,
        )
    }

    @Test
    fun `ready snapshot with unknown total is rejected`() {
        val candidate = candidate(qualityKey = CURRENT_QUALITY)

        assertEquals(
            emptyList<SongInfo>(),
            scan(
                candidate,
                Media3CacheResourceSnapshot(
                    cacheKey = candidate.identity.cacheKey,
                    totalBytes = 0L,
                    cachedBytes = TOTAL_BYTES,
                    status = PlaybackCacheStatus.READY,
                ),
            ).songs,
        )
    }

    @Test
    fun `ready row with matching current quality is accepted`() {
        val candidate = candidate(qualityKey = CURRENT_QUALITY)

        assertEquals(listOf(candidate.song), scan(candidate, readySnapshot(candidate)).songs)
    }

    @Test
    fun `ready row with different requested quality is rejected`() {
        val candidate = candidate(qualityKey = "wy-level:lossless")

        assertEquals(emptyList<SongInfo>(), scan(candidate, readySnapshot(candidate)).songs)
    }

    private fun scan(
        candidate: PlaybackCacheCatalogCandidate,
        snapshot: Media3CacheResourceSnapshot,
    ): PlaybackCacheReadyScanResult = PlaybackCacheReadyCandidateScanner.scan(
        limit = 1,
        pageSize = 10,
        loadPage = { _, _ ->
            PlaybackCacheCatalogPage(
                candidates = listOf(candidate),
                nextOffset = 1,
                exhausted = true,
            )
        },
        qualityKeyOf = { CURRENT_QUALITY },
        snapshotOf = { snapshot },
    )

    private fun candidate(
        qualityKey: String,
        status: PlaybackCacheStatus = PlaybackCacheStatus.READY,
        totalBytes: Long = TOTAL_BYTES,
        cachedBytes: Long = TOTAL_BYTES,
    ): PlaybackCacheCatalogCandidate {
        val song = SongInfo(
            id = "song-1",
            type = SongType.WY,
            name = "Song",
            artist = "Artist",
            coverUrl = "",
        )
        return PlaybackCacheCatalogCandidate(
            song = song,
            identity = CacheIdentity.create("wy", song.id, qualityKey),
            totalBytes = totalBytes,
            cachedBytes = cachedBytes,
            status = status,
            lastAccessedAt = 0L,
            updatedAt = 0L,
        )
    }

    private fun readySnapshot(
        candidate: PlaybackCacheCatalogCandidate = candidate(CURRENT_QUALITY),
    ): Media3CacheResourceSnapshot = Media3CacheResourceSnapshot(
        cacheKey = candidate.identity.cacheKey,
        totalBytes = TOTAL_BYTES,
        cachedBytes = TOTAL_BYTES,
        status = PlaybackCacheStatus.READY,
    )

    private companion object {
        const val CURRENT_QUALITY = "wy-level:standard"
        const val TOTAL_BYTES = 4_096L
    }
}
