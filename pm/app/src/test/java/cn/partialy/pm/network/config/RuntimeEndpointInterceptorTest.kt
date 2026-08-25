package cn.partialy.pm.network.config

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
        val interceptor = RuntimeEndpointInterceptor { currentEndpoints }
        val first = execute(interceptor, "${RuntimeEndpointKind.WY.placeholderBaseUrl}personalized/newsong?limit=18")
        assertEquals("https://wy.example.com/api/personalized/newsong?limit=18", first)

        currentEndpoints = endpoints.copy(wyBaseUrl = "https://new.example.com/runtime/v2/")
        val second = execute(interceptor, "${RuntimeEndpointKind.WY.placeholderBaseUrl}personalized/newsong?limit=18")
        assertEquals("https://new.example.com/runtime/v2/personalized/newsong?limit=18", second)
    }

    @Test
    fun `absolute url does not use retrofit placeholder endpoint`() {
        val interceptor = RuntimeEndpointInterceptor { endpoints }
        val result = execute(interceptor, "https://cdn.example.com/audio/file.mp3?token=abc")
        assertEquals("https://cdn.example.com/audio/file.mp3?token=abc", result)
    }

    @Test
    fun `non placeholder url is unchanged`() {
        val interceptor = RuntimeEndpointInterceptor { endpoints }
        val result = execute(interceptor, "https://api.example.com/search?q=hello%20world")
        assertEquals("https://api.example.com/search?q=hello%20world", result)
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
