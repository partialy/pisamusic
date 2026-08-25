package cn.partialy.pm.player.cache

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class OriginUrlRegistryTest {

    @Test
    fun `fresh reads resolve once`() = runBlocking {
        var nowMillis = 1_000L
        val resolveCount = AtomicInteger()
        val registry = OriginUrlRegistry(
            resolver = {
                "https://example.test/audio-${resolveCount.incrementAndGet()}.mp3"
            },
            nowMillis = { nowMillis },
        )
        registry.register(CACHE_KEY, descriptor())

        assertEquals("https://example.test/audio-1.mp3", registry.resolve(CACHE_KEY))
        assertEquals("https://example.test/audio-1.mp3", registry.resolve(CACHE_KEY))
        assertEquals(1, resolveCount.get())
    }

    @Test
    fun `stale concurrent rejections reuse the first refreshed url`() = runBlocking {
        val resolveCount = AtomicInteger()
        val registry = OriginUrlRegistry(
            resolver = {
                "https://example.test/audio-${resolveCount.incrementAndGet()}.mp3"
            },
            nowMillis = { 1_000L },
        )
        registry.register(CACHE_KEY, descriptor())

        val firstRejectedUrl = registry.resolve(CACHE_KEY)
        val secondRejectedUrl = registry.resolve(CACHE_KEY)
        assertEquals(firstRejectedUrl, secondRejectedUrl)
        assertEquals(
            "https://example.test/audio-2.mp3",
            registry.refreshAfterRejection(CACHE_KEY, firstRejectedUrl),
        )
        assertEquals(
            "https://example.test/audio-2.mp3",
            registry.refreshAfterRejection(CACHE_KEY, secondRejectedUrl),
        )
        assertEquals(2, resolveCount.get())
    }

    @Test
    fun `expiration and concurrent holes each cause only one new resolve`() = runBlocking {
        var nowMillis = 1_000L
        val resolveCount = AtomicInteger()
        val registry = OriginUrlRegistry(
            resolver = {
                delay(50)
                "https://example.test/audio-${resolveCount.incrementAndGet()}.mp3"
            },
            nowMillis = { nowMillis },
        )
        registry.register(CACHE_KEY, descriptor())
        registry.resolve(CACHE_KEY)
        nowMillis += OriginUrlRegistry.DEFAULT_TTL_MILLIS

        val first = async(Dispatchers.Default) { registry.resolve(CACHE_KEY) }
        val second = async(Dispatchers.Default) { registry.resolve(CACHE_KEY) }

        assertEquals("https://example.test/audio-2.mp3", first.await())
        assertEquals("https://example.test/audio-2.mp3", second.await())
        assertEquals(2, resolveCount.get())
    }

    private fun descriptor() = OriginUrlDescriptor(
        song = SongInfo(
            id = "123",
            type = SongType.WY,
            name = "Test",
            artist = "Artist",
            coverUrl = "",
        ),
        qualityKey = "wy-level:standard",
    )

    companion object {
        private const val CACHE_KEY = "cache-key"
    }
}
