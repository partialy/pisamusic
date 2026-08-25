package cn.partialy.pm.network.discovery

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import okhttp3.HttpUrl.Companion.toHttpUrl

class ServiceDiscoveryRulesTest {
    @Test
    fun `online discovery document can be parsed`() {
        val document = ServiceDiscoveryRules.parseAndValidate(ONLINE_DOCUMENT)

        requireNotNull(document)
        assertEquals(1, document.schemaVersion)
        assertEquals(1, document.configVersion)
        assertEquals("2026-08-24T10:35:00+08:00", document.publishedAt)
        assertEquals("/api/health", document.desktop.healthCheckPath)
        assertEquals("primary", document.desktop.serviceOrigins.single().id)
    }

    @Test
    fun `unsupported schema and invalid metadata are rejected`() {
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(schemaVersion = 2)))
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(configVersion = 0)))
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(publishedAt = "not-a-date")))
    }

    @Test
    fun `service origins must be pure HTTPS origins`() {
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(apiBaseUrl = "http://api.example.com")))
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(apiBaseUrl = "https://api.example.com/api")))
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(apiBaseUrl = "https://user:secret@api.example.com")))
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(apiBaseUrl = "https://api.example.com?debug=true")))
    }

    @Test
    fun `service paths must be root relative`() {
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(healthCheckPath = "https://api.example.com/health")))
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(bootstrapPath = "bootstrap")))
        assertNull(ServiceDiscoveryRules.parseAndValidate(documentJson(bootstrapPath = "//other.example.com/bootstrap")))
        assertNull(
            ServiceDiscoveryRules.parseAndValidate(
                documentJson().replace("\"healthCheckPath\": \"/api/health\"", "\"healthCheckPath\": \"/\\\\\\\\host\""),
            ),
        )
    }

    @Test
    fun `relative paths cannot override the selected origin`() {
        val origin = primaryOrigin()

        assertTrue(runCatching { ServiceDiscoveryRules.resolveRelative(origin, "/\\host") }.isFailure)
        listOf("/%2f%2fhost", "/%5c%5chost").forEach { path ->
            val resolved = ServiceDiscoveryRules.resolveRelative(origin, path).toHttpUrl()
            assertEquals("https", resolved.scheme)
            assertEquals("api.example.com", resolved.host)
            assertEquals(443, resolved.port)
        }
    }

    @Test
    fun `service origin identifiers are unique and required fields are present`() {
        assertNull(
            ServiceDiscoveryRules.parseAndValidate(
                documentJson(
                    serviceOrigins = """
                        {"id":"same","priority":1,"apiBaseUrl":"https://one.example.com","realtimeBaseUrl":"https://one.example.com"},
                        {"id":"same","priority":2,"apiBaseUrl":"https://two.example.com","realtimeBaseUrl":"https://two.example.com"}
                    """.trimIndent(),
                ),
            ),
        )
        assertNull(
            ServiceDiscoveryRules.parseAndValidate(
                documentJson(
                    serviceOrigins = """
                        {"id":"missing-realtime","priority":1,"apiBaseUrl":"https://one.example.com"}
                    """.trimIndent(),
                ),
            ),
        )
        assertNull(
            ServiceDiscoveryRules.parseAndValidate(
                documentJson().replace("\"minimumSupportedVersion\": \"1.0.1\"", "\"minimumSupportedVersion\": null"),
            ),
        )
        assertNull(
            ServiceDiscoveryRules.parseAndValidate(
                documentJson(serviceOrigins = ""),
            ),
        )
    }

    @Test
    fun `origins are sorted by priority and retain original order on ties`() {
        val document = requireNotNull(
            ServiceDiscoveryRules.parseAndValidate(
                documentJson(
                    serviceOrigins = """
                        {"id":"third","priority":30,"apiBaseUrl":"https://third.example.com","realtimeBaseUrl":"https://third.example.com"},
                        {"id":"first","priority":10,"apiBaseUrl":"https://first.example.com","realtimeBaseUrl":"https://first.example.com"},
                        {"id":"second","priority":10,"apiBaseUrl":"https://second.example.com","realtimeBaseUrl":"https://second.example.com"}
                    """.trimIndent(),
                ),
            ),
        )

        assertEquals(listOf("first", "second", "third"), ServiceDiscoveryRules.orderedOrigins(document).map { it.id })
    }

    @Test
    fun `remote lower than cache never rolls discovery back`() {
        val selected = ServiceDiscoveryRules.chooseDocument(
            remote = document(version = 2),
            cached = document(version = 3),
            currentVersion = 3,
        )

        assertEquals(3, selected?.configVersion)
    }

    @Test
    fun `same version prefers remote and no valid selection falls back to embedded`() {
        val remote = document(version = 3)
        assertTrue(
            ServiceDiscoveryRules.chooseDocument(
                remote = remote,
                cached = document(version = 3),
                currentVersion = 3,
            ) === remote,
        )
        assertNull(ServiceDiscoveryRules.chooseDocument(remote = null, cached = null, currentVersion = 3))
    }

    @Test
    fun `relative paths resolve against an origin`() {
        assertEquals("https://api.example.com/api/bootstrap", ServiceDiscoveryRules.resolveRelative(primaryOrigin(), "/api/bootstrap"))
    }

    private fun primaryOrigin(): DiscoveryServiceOrigin = DiscoveryServiceOrigin(
        id = "primary",
        priority = 100,
        apiBaseUrl = "https://api.example.com",
        realtimeBaseUrl = "https://realtime.example.com",
    )

    private fun document(version: Int): DiscoveryDocumentV1 = requireNotNull(
        ServiceDiscoveryRules.parseAndValidate(documentJson(configVersion = version)),
    )

    private fun documentJson(
        schemaVersion: Int = 1,
        configVersion: Int = 1,
        publishedAt: String = "2026-08-24T10:35:00+08:00",
        healthCheckPath: String = "/api/health",
        bootstrapPath: String = "/api/config/bootstrap",
        apiBaseUrl: String = "https://api.example.com",
        serviceOrigins: String? = null,
    ): String = """
        {
          "schemaVersion": $schemaVersion,
          "configVersion": $configVersion,
          "publishedAt": "$publishedAt",
          "desktop": {
            "minimumSupportedVersion": "1.0.1",
            "healthCheckPath": "$healthCheckPath",
            "bootstrapPath": "$bootstrapPath",
            "serviceOrigins": [${serviceOrigins ?: "{\"id\":\"primary\",\"priority\":100,\"apiBaseUrl\":\"$apiBaseUrl\",\"realtimeBaseUrl\":\"https://realtime.example.com\"}"}],
            "updateFeedBaseUrls": ["https://updates.example.com/api/config/desktop-updates/win32/x64"]
          }
        }
    """.trimIndent()

    private companion object {
        const val ONLINE_DOCUMENT = """
            {
              "schemaVersion": 1,
              "configVersion": 1,
              "publishedAt": "2026-08-24T10:35:00+08:00",
              "desktop": {
                "minimumSupportedVersion": "1.0.1",
                "healthCheckPath": "/api/health",
                "bootstrapPath": "/api/config/bootstrap",
                "serviceOrigins": [
                  {
                    "id": "primary",
                    "priority": 100,
                    "apiBaseUrl": "https://pm-server.hs.partialy.cn",
                    "realtimeBaseUrl": "https://pm-server.hs.partialy.cn"
                  }
                ],
                "updateFeedBaseUrls": [
                  "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64"
                ]
              }
            }
        """
    }
}
