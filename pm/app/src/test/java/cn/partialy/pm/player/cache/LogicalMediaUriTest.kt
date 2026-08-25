package cn.partialy.pm.player.cache

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.net.URI

class LogicalMediaUriTest {

    @Test
    fun `logical media uri round trips cache key`() {
        val identity = CacheIdentity.create("wy", "123", "wy-level:standard")

        assertEquals(identity.cacheKey, LogicalMediaUri.parse(identity.logicalUri))
        assertEquals(identity.logicalUri, LogicalMediaUri.create(identity.cacheKey))
    }

    @Test
    fun `other schemes and malformed logical uris are rejected`() {
        val key = CacheIdentity.create("wy", "123", "auto").cacheKey

        assertNull(LogicalMediaUri.parse(URI.create("https://media/$key")))
        assertNull(LogicalMediaUri.parse(URI.create("pmcache://other/$key")))
        assertNull(LogicalMediaUri.parse(URI.create("pmcache://media/$key/extra")))
        assertNull(LogicalMediaUri.parse(URI.create("pmcache://media/not-a-cache-key")))
    }
}
