package cn.partialy.pm.player.cache

import org.junit.Assert.assertEquals
import org.junit.Test

class CacheCoverageTest {

    @Test
    fun `only known fully continuous coverage is ready`() {
        assertEquals(PlaybackCacheStatus.PARTIAL, CacheCoverage.evaluate(0, 1024))
        assertEquals(PlaybackCacheStatus.PARTIAL, CacheCoverage.evaluate(4096, 2048))
        assertEquals(PlaybackCacheStatus.READY, CacheCoverage.evaluate(4096, 4096))
    }

    @Test
    fun `invalid and oversized coverage does not become ready`() {
        assertEquals(PlaybackCacheStatus.PARTIAL, CacheCoverage.evaluate(-1, 0))
        assertEquals(PlaybackCacheStatus.PARTIAL, CacheCoverage.evaluate(4096, -1))
        assertEquals(PlaybackCacheStatus.PARTIAL, CacheCoverage.evaluate(4096, 4097))
    }
}
