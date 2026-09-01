package cn.partialy.pm.network.discovery

import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.CancellationException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
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
            cache = UnavailableCache,
            fetchDocument = {
                val active = activeFetches.incrementAndGet()
                maxActiveFetches.updateAndGet { maxOf(it, active) }
                val call = fetchNumber.incrementAndGet()
                delay(30)
                activeFetches.decrementAndGet()
                documentJson(version = if (call == 1) 5 else 4, origins = origin("remote", 10))
            },
            healthCheck = { true },
            isDevMode = false,
        )

        val first = async { manager.refresh() }
        val second = async { manager.refresh() }
        val firstSnapshot = first.await()
        val secondSnapshot = second.await()

        assertEquals(1, maxActiveFetches.get())
        assertEquals(5, firstSnapshot.document.configVersion)
        assertEquals(5, secondSnapshot.document.configVersion)
        assertEquals(5, manager.currentSnapshot().document.configVersion)
        assertSame(firstSnapshot, secondSnapshot)
        assertTrue(manager.isCurrent(firstSnapshot))
        assertTrue(manager.isCurrent(secondSnapshot))
    }

    @Test
    fun `publish current check and state publication exclude concurrent refresh`() = runBlocking {
        var version = 2
        val manager = ServiceDiscoveryManager(
            embeddedBaseUrl = EMBEDDED_BASE_URL,
            cache = UnavailableCache,
            fetchDocument = { documentJson(version = version, origins = origin("remote", 10)) },
            healthCheck = { true },
            isDevMode = false,
        )
        val snapshot = manager.refresh()
        val publishStarted = CountDownLatch(1)
        val releasePublish = CountDownLatch(1)

        val publishing = async(Dispatchers.Default) {
            manager.publishIfCurrent(snapshot) {
                publishStarted.countDown()
                releasePublish.await()
            }
        }
        publishStarted.await()
        version = 3
        val refreshing = async(Dispatchers.Default) { manager.refresh() }
        delay(30)

        assertFalse(refreshing.isCompleted)
        releasePublish.countDown()
        assertTrue(publishing.await())
        assertEquals(3, refreshing.await().document.configVersion)
    }

    @Test
    fun `discovery document URL must be fixed HTTPS without credentials query or fragment`() {
        listOf(
            "http://pisamusic.partialy.cn/pm-config/config-v1.json",
            "https://user:secret@pisamusic.partialy.cn/pm-config/config-v1.json",
            "https://pisamusic.partialy.cn/pm-config/config-v1.json?version=1",
            "https://pisamusic.partialy.cn/pm-config/config-v1.json#latest",
        ).forEach { invalidUrl ->
            assertTrue(
                runCatching {
                    ServiceDiscoveryManager(
                        embeddedBaseUrl = EMBEDDED_BASE_URL,
                        discoveryDocumentUrl = invalidUrl,
                        cache = FakeCache(),
                        fetchDocument = { null },
                        healthCheck = { true },
                        isDevMode = false,
                    )
                }.isFailure,
            )
        }
    }

    @Test
    fun `cancellation at every IO fallback point stops refresh without publishing`() = runBlocking {
        CancelStage.entries.forEach { cancelStage ->
            val cache = object : ServiceDiscoveryCache {
                override fun read(): CachedDiscoveryDocument? {
                    cancelAt(CancelStage.CACHE_READ, cancelStage)
                    return null
                }

                override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean {
                    cancelAt(CancelStage.CACHE_SAVE, cancelStage)
                    return true
                }
            }
            val manager = ServiceDiscoveryManager(
                embeddedBaseUrl = EMBEDDED_BASE_URL,
                cache = cache,
                fetchDocument = {
                    cancelAt(CancelStage.FETCH, cancelStage)
                    documentJson(version = 2, origins = origin("remote", 10))
                },
                healthCheck = {
                    cancelAt(CancelStage.HEALTH, cancelStage)
                    true
                },
                isDevMode = false,
            )
            val before = manager.currentSnapshot()

            try {
                manager.refresh()
                fail("$cancelStage cancellation must be rethrown")
            } catch (_: CancellationException) {
                // 预期：取消不能被当成普通 I/O 失败降级。
            }

            assertSame(cancelStage.name, before, manager.currentSnapshot())
        }
    }

    @Test
    fun `cache fetch and health work run on injected IO dispatcher`() {
        Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "discovery-test-io") }
            .asCoroutineDispatcher()
            .use { dispatcher ->
                val threads = mutableListOf<String>()
                val cache = object : ServiceDiscoveryCache {
                    override fun read(): CachedDiscoveryDocument? {
                        threads += "read:${Thread.currentThread().name}"
                        return null
                    }

                    override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean {
                        threads += "save:${Thread.currentThread().name}"
                        return true
                    }
                }
                val manager = ServiceDiscoveryManager(
                    embeddedBaseUrl = EMBEDDED_BASE_URL,
                    cache = cache,
                    fetchDocument = {
                        threads += "fetch:${Thread.currentThread().name}"
                        documentJson(version = 2, origins = origin("remote", 10))
                    },
                    healthCheck = {
                        threads += "health:${Thread.currentThread().name}"
                        true
                    },
                    ioDispatcher = dispatcher,
                    isDevMode = false,
                )

                runBlocking { manager.refresh() }

                assertEquals(4, threads.size)
                assertTrue(threads.all { it.substringAfter(':').startsWith("discovery-test-io") })
            }
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

    @Test
    fun `dev mode uses embedded base url directly and skips remote discovery`() = runBlocking {
        var remoteFetched = false
        val cache = FakeCache(CachedDiscoveryDocument(documentJson(version = 10, origins = origin("cached", 10)), 10))
        val manager = ServiceDiscoveryManager(
            embeddedBaseUrl = "http://192.168.9.100:53380/",
            cache = cache,
            fetchDocument = {
                remoteFetched = true
                documentJson(version = 20, origins = origin("remote", 10))
            },
            healthCheck = { true },
            isDevMode = true,
        )

        val snapshot = manager.refresh()

        assertFalse(remoteFetched)
        assertEquals(ServiceDiscoverySource.EMBEDDED, snapshot.source)
        assertEquals("http://192.168.9.100:53380/api/config/bootstrap", manager.resolveApiUrl("/api/config/bootstrap"))
        assertEquals("http://192.168.9.100:53380", manager.currentRealtimeBaseUrl())
    }

    private fun manager(
        cache: ServiceDiscoveryCache = FakeCache(),
        remoteRaw: String?,
        healthCheck: suspend (String) -> Boolean,
        isDevMode: Boolean = false,
    ): ServiceDiscoveryManager = ServiceDiscoveryManager(
        embeddedBaseUrl = EMBEDDED_BASE_URL,
        cache = cache,
        fetchDocument = { remoteRaw },
        healthCheck = healthCheck,
        isDevMode = isDevMode,
    )

    private fun origin(id: String, priority: Int): String =
        """{"id":"$id","priority":$priority,"apiBaseUrl":"https://$id.example.com","realtimeBaseUrl":"https://$id.example.com"}"""

    private fun cancelAt(expected: CancelStage, actual: CancelStage) {
        if (expected == actual) throw CancellationException("cancel at $actual")
    }

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

    private object UnavailableCache : ServiceDiscoveryCache {
        override fun read(): CachedDiscoveryDocument? = null

        override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean = false
    }

    private companion object {
        const val EMBEDDED_BASE_URL = "http://192.168.9.100:53380/"
    }

    private enum class CancelStage {
        FETCH,
        CACHE_READ,
        CACHE_SAVE,
        HEALTH,
    }
}
