package cn.partialy.pm.network.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class RuntimeEndpointUnavailableRulesTest {
    @Test
    fun `music endpoints are unavailable before bootstrap succeeds`() {
        val endpoints = ConfigManager.createUnavailableEndpoints()
        val values = listOf(
            endpoints.kgBaseUrl,
            endpoints.wyBaseUrl,
            endpoints.proxyBaseUrl,
            endpoints.kwBaseUrl,
            endpoints.kgSongUrl,
            endpoints.wySongUrl,
            endpoints.wySongUrlV1,
        )

        values.forEach { endpoint ->
            assertEquals("https://music-runtime.invalid/", endpoint)
            assertFalse(endpoint.contains("192.168."))
            assertFalse(endpoint.contains("pm-server"))
        }
    }
}
