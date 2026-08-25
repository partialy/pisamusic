package cn.partialy.pm.player.cache

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class CacheIdentityTest {

    @Test
    fun `same song and quality ignores case and temporary url`() {
        val first = CacheIdentity.create("WY", " 123 ", "AUTO")
        val second = CacheIdentity.create("wy", "123", "auto")

        assertEquals(first.cacheKey, second.cacheKey)
        assertEquals("pmcache://media/${first.cacheKey}", first.logicalUri.toString())
    }

    @Test
    fun `different quality never shares cache key`() {
        assertNotEquals(
            CacheIdentity.create("wy", "123", "wy-level:standard").cacheKey,
            CacheIdentity.create("wy", "123", "wy-level:lossless").cacheKey,
        )
    }

    @Test
    fun `nul in fields cannot create an identity boundary collision`() {
        val first = CacheIdentity.create("a\u0000b", "c", "d")
        val second = CacheIdentity.create("a", "b\u0000c", "d")

        assertNotEquals(first.cacheKey, second.cacheKey)
    }

    @Test
    fun `blank quality defaults without sharing another quality`() {
        val defaultIdentity = CacheIdentity.create("wy", "123", "  ")

        assertEquals("default", defaultIdentity.qualityKey)
        assertNotEquals(
            defaultIdentity.cacheKey,
            CacheIdentity.create("wy", "123", "auto").cacheKey,
        )
    }

    @Test
    fun `blank source and song id are rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            CacheIdentity.create(" ", "123", "auto")
        }
        assertThrows(IllegalArgumentException::class.java) {
            CacheIdentity.create("wy", " ", "auto")
        }
    }
}
