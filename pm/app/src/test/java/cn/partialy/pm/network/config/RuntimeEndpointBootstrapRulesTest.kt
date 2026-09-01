package cn.partialy.pm.network.config

import cn.partialy.pm.model.BootstrapConfigData
import cn.partialy.pm.model.BootstrapConfigResponse
import cn.partialy.pm.model.BootstrapEndpoints
import cn.partialy.pm.model.GatewaySignConfig
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.discovery.CachedDiscoveryDocument
import cn.partialy.pm.network.discovery.ServiceDiscoveryCache
import cn.partialy.pm.network.discovery.ServiceDiscoveryManager
import java.lang.reflect.Proxy
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class RuntimeEndpointBootstrapRulesTest {
    @Test
    fun `bootstrap uses discovered relative path and atomically publishes config`() = runBlocking {
        val manager = discoveryManager { documentJson(version = 2, bootstrapPath = "/api/bootstrap-v2") }
        var requestedPath: String? = null
        val configManager = ConfigManager(
            systemApiService = systemApiService { path ->
                requestedPath = path
                bootstrapResponse()
            },
            serviceDiscoveryManager = manager,
        )

        configManager.refreshBootstrapConfig()

        assertEquals("api/bootstrap-v2", requestedPath)
        assertEquals("https://kg.example.com/", configManager.getEndpoints().kgBaseUrl)
        assertEquals("bootstrap-secret", configManager.getGatewaySign().secret)
        val songTarget = configManager.kgSongTarget()
        assertEquals(songTarget.state.endpoints.kgSongUrl, songTarget.url)
    }

    @Test
    fun `response from stale discovery snapshot is rejected without changing endpoints`() = runBlocking {
        var version = 2
        val manager = discoveryManager { documentJson(version = version, bootstrapPath = "/api/bootstrap-v$version") }
        val configManager = ConfigManager(
            systemApiService = systemApiService {
                version = 3
                manager.refresh()
                bootstrapResponse()
            },
            serviceDiscoveryManager = manager,
        )
        val unavailable = configManager.getEndpoints()

        val failure = runCatching { configManager.refreshBootstrapConfig() }.exceptionOrNull()

        assertTrue(failure is IllegalStateException)
        assertSame(unavailable, configManager.getEndpoints())
    }

    @Test
    fun `enter local mode resets endpoints and rejects late bootstrap publication`() = runBlocking {
        val manager = discoveryManager { documentJson(version = 2, bootstrapPath = "/api/bootstrap-v2") }
        lateinit var configManager: ConfigManager
        configManager = ConfigManager(
            systemApiService = systemApiService {
                configManager.enterLocalMode()
                bootstrapResponse()
            },
            serviceDiscoveryManager = manager,
        )

        val failure = runCatching { configManager.refreshBootstrapConfig() }.exceptionOrNull()

        assertTrue(failure is IllegalStateException)
        assertEquals("https://music-runtime.invalid/", configManager.getEndpoints().kgBaseUrl)
        assertTrue(configManager.isLocalMode())
    }

    @Test
    fun `local mode blocks refresh until a new online startup begins`() = runBlocking {
        val manager = discoveryManager { documentJson(version = 2, bootstrapPath = "/api/bootstrap-v2") }
        var apiCalls = 0
        val configManager = ConfigManager(
            systemApiService = systemApiService {
                apiCalls++
                bootstrapResponse()
            },
            serviceDiscoveryManager = manager,
        )
        configManager.refreshBootstrapConfig()
        assertEquals("https://kg.example.com/", configManager.getEndpoints().kgBaseUrl)

        configManager.enterLocalMode()
        assertEquals("https://music-runtime.invalid/", configManager.getEndpoints().kgBaseUrl)
        assertTrue(runCatching { configManager.refreshBootstrapConfig() }.isFailure)
        assertEquals(1, apiCalls)

        configManager.beginOnlineStartup()
        configManager.refreshBootstrapConfig()
        assertEquals(2, apiCalls)
        assertEquals("https://kg.example.com/", configManager.getEndpoints().kgBaseUrl)
    }

    private fun discoveryManager(document: () -> String): ServiceDiscoveryManager = ServiceDiscoveryManager(
        embeddedBaseUrl = "https://embedded.example.com/",
        cache = object : ServiceDiscoveryCache {
            override fun read(): CachedDiscoveryDocument? = null
            override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean = true
        },
        fetchDocument = { document() },
        healthCheck = { true },
        isDevMode = false,
    )

    @Suppress("UNCHECKED_CAST")
    private fun systemApiService(
        bootstrap: suspend (String) -> BootstrapConfigResponse,
    ): SystemApiService = Proxy.newProxyInstance(
        SystemApiService::class.java.classLoader,
        arrayOf(SystemApiService::class.java),
    ) { _, method, args ->
        when (method.name) {
            "getBootstrapConfig" -> runBlocking { bootstrap(args.orEmpty().first() as String) }
            "toString" -> "FakeSystemApiService"
            else -> error("Unexpected SystemApiService call: ${method.name}")
        }
    } as SystemApiService

    private fun bootstrapResponse() = BootstrapConfigResponse(
        msg = "ok",
        code = 0,
        data = BootstrapConfigData(
            endpoints = BootstrapEndpoints(
                kgBaseUrl = "https://kg.example.com",
                wyBaseUrl = "https://wy.example.com",
                proxyBaseUrl = "https://proxy.example.com",
                kwBaseUrl = "https://kw.example.com",
                kgSongUrl = "https://song.example.com/kg",
                wySongUrl = "https://song.example.com/wy",
                wySongUrlV1 = "https://song.example.com/wy-v1",
            ),
            gatewaySign = GatewaySignConfig(secret = "bootstrap-secret", `as` = "bootstrap-as"),
        ),
    )

    private fun documentJson(version: Int, bootstrapPath: String) = """
        {
          "schemaVersion": 1,
          "configVersion": $version,
          "publishedAt": "2026-08-25T09:00:00+08:00",
          "desktop": {
            "minimumSupportedVersion": "1.0.1",
            "healthCheckPath": "/api/health",
            "bootstrapPath": "$bootstrapPath",
            "serviceOrigins": [{
              "id": "remote",
              "priority": 10,
              "apiBaseUrl": "https://system-v$version.example.com",
              "realtimeBaseUrl": "https://system-v$version.example.com"
            }],
            "updateFeedBaseUrls": ["https://updates.example.com/win32/x64"]
          }
        }
    """.trimIndent()
}
