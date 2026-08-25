package cn.partialy.pm.player.cache

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Test

class PlaybackCacheReadySongsPaginationTest {

    @Test
    fun `quality filtered first page still finds ready song on later page`() {
        val candidates = listOf(
            candidate("old-1", "wy-level:lossless"),
            candidate("old-2", "wy-level:lossless"),
            candidate("current", "wy-level:standard"),
        )
        val requestedOffsets = mutableListOf<Int>()
        val snapshottedKeys = mutableListOf<String>()

        val result = PlaybackCacheReadyCandidateScanner.scan(
            limit = 1,
            pageSize = 2,
            loadPage = { offset, pageSize ->
                requestedOffsets += offset
                val pageCandidates = candidates.drop(offset).take(pageSize)
                PlaybackCacheCatalogPage(
                    candidates = pageCandidates,
                    nextOffset = offset + pageCandidates.size,
                    exhausted = offset + pageCandidates.size >= candidates.size,
                )
            },
            qualityKeyOf = { "wy-level:standard" },
            snapshotOf = { cacheKey ->
                snapshottedKeys += cacheKey
                Media3CacheResourceSnapshot(
                    cacheKey = cacheKey,
                    totalBytes = 4_096L,
                    cachedBytes = 4_096L,
                    status = PlaybackCacheStatus.READY,
                )
            },
        )

        assertEquals(listOf("current"), result.songs.map(SongInfo::id))
        assertEquals(listOf(0, 2), requestedOffsets)
        assertEquals(listOf(candidates.last().identity.cacheKey), snapshottedKeys)
        assertEquals(1, result.snapshots.size)
    }

    private fun candidate(id: String, qualityKey: String): PlaybackCacheCatalogCandidate {
        val song = SongInfo(
            id = id,
            type = SongType.WY,
            name = "Song $id",
            artist = "Artist",
            coverUrl = "",
        )
        return PlaybackCacheCatalogCandidate(
            song = song,
            identity = CacheIdentity.create("wy", id, qualityKey),
            totalBytes = 4_096L,
            cachedBytes = 4_096L,
            status = PlaybackCacheStatus.READY,
            lastAccessedAt = 0L,
            updatedAt = 0L,
        )
    }
}
