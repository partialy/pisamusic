package cn.partialy.pm.network.config

import cn.partialy.pm.network.gateway.GatewaySignInterceptor
import cn.partialy.pm.network.gateway.GatewaySignRuntime
import cn.partialy.pm.network.gateway.GatewaySigner
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test

class RuntimeEndpointInterceptorTest {
    private val endpoints = ConfigManager.RuntimeEndpoints(
        kgBaseUrl = "https://kg.example.com/gateway/v1/",
        wyBaseUrl = "https://wy.example.com/api/",
        proxyBaseUrl = "https://proxy.example.com/music/",
        kwBaseUrl = "https://kw.example.com/",
        kgSongUrl = "https://song.example.com/kg",
        wySongUrl = "https://song.example.com/wy",
        wySongUrlV1 = "https://song.example.com/wy/v1",
    )

    @Test
    fun `relative request uses latest endpoint and keeps base path query`() {
        var currentEndpoints = endpoints
        val interceptor = RuntimeEndpointInterceptor(endpointProvider = { currentEndpoints })
        val first = execute(interceptor, "${RuntimeEndpointKind.WY.placeholderBaseUrl}personalized/newsong?limit=18")
        assertEquals("https://wy.example.com/api/personalized/newsong?limit=18", first)

        currentEndpoints = endpoints.copy(wyBaseUrl = "https://new.example.com/runtime/v2/")
        val second = execute(interceptor, "${RuntimeEndpointKind.WY.placeholderBaseUrl}personalized/newsong?limit=18")
        assertEquals("https://new.example.com/runtime/v2/personalized/newsong?limit=18", second)
    }

    @Test
    fun `absolute url does not use retrofit placeholder endpoint`() {
        val interceptor = RuntimeEndpointInterceptor(endpointProvider = { endpoints })
        val result = execute(interceptor, "https://cdn.example.com/audio/file.mp3?token=abc")
        assertEquals("https://cdn.example.com/audio/file.mp3?token=abc", result)
    }

    @Test
    fun `non placeholder url is unchanged`() {
        val interceptor = RuntimeEndpointInterceptor(endpointProvider = { endpoints })
        val result = execute(interceptor, "https://api.example.com/search?q=hello%20world")
        assertEquals("https://api.example.com/search?q=hello%20world", result)
    }

    @Test
    fun `rewritten request keeps one bootstrap snapshot through gateway signing`() {
        val oldState = ConfigManager.RuntimeBootstrapState(
            endpoints = endpoints.copy(kgBaseUrl = "https://old.example.com/api/"),
            gatewaySign = ConfigManager.RuntimeGatewaySign("old-secret", "old-as"),
            gatewayEndpointPrefixes = setOf("https://old.example.com/api/"),
        )
        val newState = ConfigManager.RuntimeBootstrapState(
            endpoints = endpoints.copy(kgBaseUrl = "https://new.example.com/api/"),
            gatewaySign = ConfigManager.RuntimeGatewaySign("new-secret", "new-as"),
            gatewayEndpointPrefixes = setOf("https://new.example.com/api/"),
        )
        var currentState = oldState
        GatewaySignRuntime.bind { currentState }
        val endpointInterceptor = RuntimeEndpointInterceptor(
            endpointProvider = { currentState.endpoints },
            runtimeStateProvider = { currentState },
        )
        var proceededRequest: Request? = null
        val switchState = okhttp3.Interceptor { chain ->
            currentState = newState
            chain.proceed(chain.request())
        }
        val terminal = okhttp3.Interceptor { chain ->
            proceededRequest = chain.request()
            Response.Builder()
                .request(chain.request())
                .protocol(okhttp3.Protocol.HTTP_1_1)
                .code(200)
                .message("OK")
                .body(ByteArray(0).toResponseBody(null))
                .build()
        }

        OkHttpClient.Builder()
            .addInterceptor(endpointInterceptor)
            .addInterceptor(switchState)
            .addInterceptor(GatewaySignInterceptor())
            .addInterceptor(terminal)
            .build()
            .newCall(Request.Builder().url("${RuntimeEndpointKind.KG.placeholderBaseUrl}search?q=hello").build())
            .execute()
            .close()

        val request = requireNotNull(proceededRequest)
        assertEquals("https://old.example.com/api/search?q=hello&res-dec=1", request.url.toString())
        val timestamp = requireNotNull(request.header("t"))
        val nonce = requireNotNull(request.header("n"))
        assertEquals(
            GatewaySigner.buildSignature(
                method = "GET",
                url = request.url,
                bodyBytes = ByteArray(0),
                timestamp = timestamp,
                nonce = nonce,
                asValue = "old-as",
                secret = "old-secret",
            ),
            request.header("s"),
        )
    }

    @Test
    fun `absolute url keeps caller snapshot instead of interceptor current state`() {
        val callerState = ConfigManager.RuntimeBootstrapState(
            endpoints = endpoints.copy(kgSongUrl = "https://old-song.example.com/kg"),
            gatewaySign = ConfigManager.RuntimeGatewaySign("old-secret", "old-as"),
            gatewayEndpointPrefixes = setOf("https://old-song.example.com/kg"),
        )
        val currentState = ConfigManager.RuntimeBootstrapState(
            endpoints = endpoints.copy(kgSongUrl = "https://new-song.example.com/kg"),
            gatewaySign = ConfigManager.RuntimeGatewaySign("new-secret", "new-as"),
            gatewayEndpointPrefixes = setOf("https://new-song.example.com/kg"),
        )
        GatewaySignRuntime.bind { currentState }
        val endpointInterceptor = RuntimeEndpointInterceptor(
            endpointProvider = { currentState.endpoints },
            runtimeStateProvider = { currentState },
        )
        var proceededRequest: Request? = null
        val terminal = okhttp3.Interceptor { chain ->
            proceededRequest = chain.request()
            Response.Builder()
                .request(chain.request())
                .protocol(okhttp3.Protocol.HTTP_1_1)
                .code(200)
                .message("OK")
                .body(ByteArray(0).toResponseBody(null))
                .build()
        }
        val request = Request.Builder()
            .url("https://old-song.example.com/kg?hash=abc")
            .tag(ConfigManager.RuntimeBootstrapState::class.java, callerState)
            .build()

        OkHttpClient.Builder()
            .addInterceptor(endpointInterceptor)
            .addInterceptor(GatewaySignInterceptor())
            .addInterceptor(terminal)
            .build()
            .newCall(request)
            .execute()
            .close()

        val signed = requireNotNull(proceededRequest)
        assertEquals("https://old-song.example.com/kg?hash=abc&res-dec=1", signed.url.toString())
        val timestamp = requireNotNull(signed.header("t"))
        val nonce = requireNotNull(signed.header("n"))
        assertEquals(
            GatewaySigner.buildSignature(
                method = "GET",
                url = signed.url,
                bodyBytes = ByteArray(0),
                timestamp = timestamp,
                nonce = nonce,
                asValue = "old-as",
                secret = "old-secret",
            ),
            signed.header("s"),
        )
    }

    private fun execute(interceptor: RuntimeEndpointInterceptor, url: String): String {
        var proceededUrl: String? = null
        val terminal = okhttp3.Interceptor { chain ->
            proceededUrl = chain.request().url.toString()
            Response.Builder()
                .request(chain.request())
                .protocol(okhttp3.Protocol.HTTP_1_1)
                .code(200)
                .message("OK")
                .body(ByteArray(0).toResponseBody(null))
                .build()
        }
        OkHttpClient.Builder()
            .addInterceptor(interceptor)
            .addInterceptor(terminal)
            .build()
            .newCall(Request.Builder().url(url).build())
            .execute()
            .close()
        return requireNotNull(proceededUrl)
    }
}
