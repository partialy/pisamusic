package cn.partialy.pm.network.config

import cn.partialy.pm.model.AndroidStartupData
import cn.partialy.pm.model.AndroidStartupRequest
import cn.partialy.pm.model.AndroidStartupResponse
import cn.partialy.pm.model.BootstrapConfigData
import cn.partialy.pm.model.BootstrapEndpoints
import cn.partialy.pm.model.DeviceReportRequest
import cn.partialy.pm.model.DeviceReportResult
import cn.partialy.pm.model.GatewaySignConfig
import cn.partialy.pm.model.StartupAgreementPayload
import cn.partialy.pm.model.UpdateInfo
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.discovery.CachedDiscoveryDocument
import cn.partialy.pm.network.discovery.ServiceDiscoveryCache
import cn.partialy.pm.network.discovery.ServiceDiscoveryManager
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Proxy

class ServiceDiscoverySwrTest {

    @Test
    fun `swr uses cached origin without blocking on remote discovery`() = runBlocking {
        var discoveryFetchCount = 0
        var healthCheckCount = 0
        val cachedDoc = CachedDiscoveryDocument(
            rawJson = documentJson(version = 2, origin = "https://cached.example.com"),
            configVersion = 2,
        )
        val manager = ServiceDiscoveryManager(
            embeddedBaseUrl = "https://embedded.example.com/",
            cache = object : ServiceDiscoveryCache {
                override fun read(): CachedDiscoveryDocument = cachedDoc
                override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean = true
            },
            fetchDocument = {
                discoveryFetchCount++
                documentJson(version = 3, origin = "https://remote.example.com")
            },
            healthCheck = {
                healthCheckCount++
                true
            },
            isDevMode = false,
        )
        val snapshotStore = StartupSnapshotStore()
        var observedOrigin = ""
        val configManager = ConfigManager(
            systemApiService = startupApiService {
                observedOrigin = manager.resolveApiUrl("/api/config/startup")
                startupResponse()
            },
            serviceDiscoveryManager = manager,
            startupSnapshotStore = snapshotStore,
        )

        val data = configManager.executeStartupBootstrap(
            request = sampleRequest(),
            bearerToken = "user-jwt",
            refreshDiscoveryInBackground = false,
        )

        assertEquals("https://cached.example.com/api/config/startup", observedOrigin)
        assertEquals(0, discoveryFetchCount)
        assertEquals(0, healthCheckCount)
        assertEquals("https://kg.example.com/", configManager.getEndpoints().kgBaseUrl)
        assertEquals(data, snapshotStore.consume())
        assertNull(snapshotStore.consume())
    }

    @Test
    fun `swr falls back to synchronous discovery refresh and retries when cached origin fails`() = runBlocking {
        var discoveryFetchCount = 0
        val cachedDoc = CachedDiscoveryDocument(
            rawJson = documentJson(version = 2, origin = "https://stale.example.com"),
            configVersion = 2,
        )
        val manager = ServiceDiscoveryManager(
            embeddedBaseUrl = "https://embedded.example.com/",
            cache = object : ServiceDiscoveryCache {
                override fun read(): CachedDiscoveryDocument = cachedDoc
                override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean = true
            },
            fetchDocument = {
                discoveryFetchCount++
                documentJson(version = 3, origin = "https://fresh.example.com")
            },
            healthCheck = { true },
            isDevMode = false,
        )
        val snapshotStore = StartupSnapshotStore()
        var callCount = 0
        val seenOrigins = mutableListOf<String>()
        val configManager = ConfigManager(
            systemApiService = startupApiService {
                callCount++
                seenOrigins += manager.resolveApiUrl("/api/config/startup")
                if (callCount == 1) {
                    throw IllegalStateException("cached host unreachable")
                }
                startupResponse()
            },
            serviceDiscoveryManager = manager,
            startupSnapshotStore = snapshotStore,
        )

        configManager.executeStartupBootstrap(
            request = sampleRequest(),
            bearerToken = null,
            refreshDiscoveryInBackground = false,
        )

        assertEquals(2, callCount)
        assertEquals(1, discoveryFetchCount)
        assertEquals(
            listOf(
                "https://stale.example.com/api/config/startup",
                "https://fresh.example.com/api/config/startup",
            ),
            seenOrigins,
        )
        assertNotNull(snapshotStore.consume())
    }

    @Test
    fun `service unavailable -233 does not retry against discovery`() = runBlocking {
        var discoveryFetchCount = 0
        val cachedDoc = CachedDiscoveryDocument(
            rawJson = documentJson(version = 2, origin = "https://cached.example.com"),
            configVersion = 2,
        )
        val manager = ServiceDiscoveryManager(
            embeddedBaseUrl = "https://embedded.example.com/",
            cache = object : ServiceDiscoveryCache {
                override fun read(): CachedDiscoveryDocument = cachedDoc
                override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean = true
            },
            fetchDocument = {
                discoveryFetchCount++
                documentJson(version = 3, origin = "https://fresh.example.com")
            },
            healthCheck = { true },
            isDevMode = false,
        )
        val configManager = ConfigManager(
            systemApiService = startupApiService {
                startupResponse(code = -233, success = false, msg = "维护中")
            },
            serviceDiscoveryManager = manager,
            startupSnapshotStore = StartupSnapshotStore(),
        )

        val err = runCatching {
            configManager.executeStartupBootstrap(sampleRequest(), null, refreshDiscoveryInBackground = false)
        }.exceptionOrNull()

        assertTrue(err is ConfigManager.ApiException && err.code == -233)
        assertEquals(0, discoveryFetchCount)
    }

    @Suppress("UNCHECKED_CAST")
    private fun startupApiService(
        handler: suspend () -> AndroidStartupResponse,
    ): SystemApiService = Proxy.newProxyInstance(
        SystemApiService::class.java.classLoader,
        arrayOf(SystemApiService::class.java),
    ) { _, method, _ ->
        when (method.name) {
            "androidStartup" -> runBlocking { handler() }
            "toString" -> "FakeStartupApiService"
            else -> error("Unexpected SystemApiService call: ${method.name}")
        }
    } as SystemApiService

    private fun sampleRequest() = AndroidStartupRequest(
        device = DeviceReportRequest(
            deviceName = "Pixel",
            brand = "Google",
            model = "Pixel 8",
            osVersion = "15",
            sdkVersion = 35,
            appVersion = "1.0.0",
            appVersionCode = 100L,
            androidId = "aid-1",
        ),
        agreementVersion = 1L,
    )

    private fun startupResponse(
        code: Int = 0,
        success: Boolean = true,
        msg: String = "ok",
    ) = AndroidStartupResponse(
        msg = msg,
        code = code,
        success = success,
        data = AndroidStartupData(
            bootstrap = BootstrapConfigData(
                endpoints = BootstrapEndpoints(
                    kgBaseUrl = "https://kg.example.com",
                    wyBaseUrl = "https://wy.example.com",
                    proxyBaseUrl = "https://proxy.example.com",
                    kwBaseUrl = "https://kw.example.com",
                    kgSongUrl = "https://song.example.com/kg",
                    wySongUrl = "https://song.example.com/wy",
                    wySongUrlV1 = "https://song.example.com/wy-v1",
                ),
                gatewaySign = GatewaySignConfig(secret = "secret", `as` = "as"),
            ),
            update = UpdateInfo("1.0.0", "2026-11-19", false, "", "", ""),
            agreement = StartupAgreementPayload(version = 1L, acceptedUpToDate = true),
            device = DeviceReportResult("d1", "mtok", false, null, 1L, 1L),
        ),
    )

    private fun documentJson(version: Int, origin: String) = """
        {
          "schemaVersion": 1,
          "configVersion": $version,
          "publishedAt": "2026-08-25T09:00:00+08:00",
          "desktop": {
            "minimumSupportedVersion": "1.0.1",
            "healthCheckPath": "/api/health",
            "bootstrapPath": "/api/config/bootstrap",
            "serviceOrigins": [{
              "id": "node-$version",
              "priority": 10,
              "apiBaseUrl": "$origin",
              "realtimeBaseUrl": "$origin"
            }],
            "updateFeedBaseUrls": ["https://updates.example.com/win32/x64"]
          }
        }
    """.trimIndent()
}
