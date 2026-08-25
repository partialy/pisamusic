package cn.partialy.pm.network.discovery

import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ServiceDiscoveryResolverTest {
    @Test
    fun `valid remote document is selected and cached`() = runBlocking {
        val cache = FakeCache()
        val manager = manager(
            cache = cache,
            remoteRaw = documentJson(version = 2, origins = origin("remote", 10)),
            healthCheck = { true },
        )

        val snapshot = manager.refresh()

        assertEquals(ServiceDiscoverySource.REMOTE, snapshot.source)
        assertEquals(2, snapshot.document.configVersion)
        assertEquals(2, cache.record?.configVersion)
        assertEquals("https://remote.example.com/api/config", manager.resolveApiUrl("/api/config"))
        assertEquals("https://remote.example.com", manager.currentRealtimeBaseUrl())
        assertTrue(manager.isCurrent(snapshot))
    }

    @Test
    fun `higher cache wins over lower remote without being overwritten`() = runBlocking {
        val cachedRaw = documentJson(version = 3, origins = origin("cached", 10))
        val cache = FakeCache(CachedDiscoveryDocument(cachedRaw, 3))
        val manager = manager(
            cache = cache,
            remoteRaw = documentJson(version = 2, origins = origin("remote", 10)),
            healthCheck = { true },
        )

        val snapshot = manager.refresh()

        assertEquals(ServiceDiscoverySource.CACHE, snapshot.source)
        assertEquals(3, snapshot.document.configVersion)
        assertEquals(cachedRaw, cache.record?.rawJson)
    }

    @Test
    fun `invalid remote and cache fall back to trusted embedded origin`() = runBlocking {
        val cache = FakeCache(CachedDiscoveryDocument("{not-json", 9))
        val manager = manager(cache = cache, remoteRaw = "{}", healthCheck = { false })

        val snapshot = manager.refresh()

        assertEquals(ServiceDiscoverySource.EMBEDDED, snapshot.source)
        assertEquals("http://192.168.9.100:53380/api/config", manager.resolveApiUrl("/api/config"))
        assertEquals("http://192.168.9.100:53380", manager.currentRealtimeBaseUrl())
    }

    @Test
    fun `origins are health checked by priority until one succeeds`() = runBlocking {
        val checked = mutableListOf<String>()
        val manager = manager(
            remoteRaw = documentJson(
                version = 2,
                origins = listOf(
                    origin("last", 30),
                    origin("first", 10),
                    origin("second", 20),
                ).joinToString(),
            ),
            healthCheck = { url ->
                checked += url
                url.startsWith("https://second.example.com")
            },
        )

        manager.refresh()

        assertEquals(
            listOf(
                "https://first.example.com/api/health",
                "https://second.example.com/api/health",
            ),
            checked,
        )
        assertEquals("https://second.example.com", manager.currentRealtimeBaseUrl())
    }

    @Test
    fun `first priority origin is retained when all health checks fail`() = runBlocking {
        val manager = manager(
            remoteRaw = documentJson(
                version = 2,
                origins = listOf(origin("second", 20), origin("first", 10)).joinToString(),
            ),
            healthCheck = { false },
        )

        manager.refresh()

        assertEquals("https://first.example.com", manager.currentRealtimeBaseUrl())
    }

    @Test
    fun `refresh is serialized and current snapshot never rolls back`() = runBlocking {
        val activeFetches = AtomicInteger(0)
        val maxActiveFetches = AtomicInteger(0)
        val fetchNumber = AtomicInteger(0)
        val manager = ServiceDiscoveryManager(
            embeddedBaseUrl = EMBEDDED_BASE_URL,
            cache = FakeCache(),
            fetchDocument = {
                val active = activeFetches.incrementAndGet()
                maxActiveFetches.updateAndGet { maxOf(it, active) }
                val call = fetchNumber.incrementAndGet()
                delay(30)
                activeFetches.decrementAndGet()
                documentJson(version = if (call == 1) 5 else 4, origins = origin("remote", 10))
            },
            healthCheck = { true },
        )

        val first = async { manager.refresh() }
        val second = async { manager.refresh() }
        val firstSnapshot = first.await()
        val secondSnapshot = second.await()

        assertEquals(1, maxActiveFetches.get())
        assertEquals(5, firstSnapshot.document.configVersion)
        assertEquals(5, secondSnapshot.document.configVersion)
        assertEquals(5, manager.currentSnapshot().document.configVersion)
        assertFalse(manager.isCurrent(firstSnapshot))
        assertTrue(manager.isCurrent(secondSnapshot))
    }

    @Test
    fun `cache raw json is revalidated and metadata mismatch is rejected`() = runBlocking {
        val cache = FakeCache(
            CachedDiscoveryDocument(
                rawJson = documentJson(version = 2, origins = origin("cached", 10)),
                configVersion = 8,
            ),
        )
        val manager = manager(cache = cache, remoteRaw = null, healthCheck = { true })

        val snapshot = manager.refresh()

        assertEquals(ServiceDiscoverySource.EMBEDDED, snapshot.source)
    }

    private fun manager(
        cache: ServiceDiscoveryCache = FakeCache(),
        remoteRaw: String?,
        healthCheck: suspend (String) -> Boolean,
    ): ServiceDiscoveryManager = ServiceDiscoveryManager(
        embeddedBaseUrl = EMBEDDED_BASE_URL,
        cache = cache,
        fetchDocument = { remoteRaw },
        healthCheck = healthCheck,
    )

    private fun origin(id: String, priority: Int): String =
        """{"id":"$id","priority":$priority,"apiBaseUrl":"https://$id.example.com","realtimeBaseUrl":"https://$id.example.com"}"""

    private fun documentJson(version: Int, origins: String): String = """
        {
          "schemaVersion": 1,
          "configVersion": $version,
          "publishedAt": "2026-08-25T09:00:00+08:00",
          "desktop": {
            "minimumSupportedVersion": "1.0.1",
            "healthCheckPath": "/api/health",
            "bootstrapPath": "/api/config/bootstrap",
            "serviceOrigins": [$origins],
            "updateFeedBaseUrls": ["https://updates.example.com/win32/x64"]
          }
        }
    """.trimIndent()

    private class FakeCache(
        initial: CachedDiscoveryDocument? = null,
    ) : ServiceDiscoveryCache {
        var record: CachedDiscoveryDocument? = initial
            private set

        override fun read(): CachedDiscoveryDocument? = record

        override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean {
            val current = record
            if (current != null && configVersion < current.configVersion) return false
            record = CachedDiscoveryDocument(rawJson, configVersion)
            return true
        }
    }

    private companion object {
        const val EMBEDDED_BASE_URL = "http://192.168.9.100:53380/"
    }
}
