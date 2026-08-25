package cn.partialy.pm.network.discovery

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test

class SystemServiceEndpointInterceptorTest {
    @Test
    fun `placeholder request uses latest discovery origin and keeps path query`() {
        var origin = "https://first.example.com"
        val interceptor = SystemServiceEndpointInterceptor { path -> "$origin$path" }

        assertEquals(
            "https://first.example.com/api/config/bootstrap?channel=debug",
            execute(interceptor, "${SystemServiceEndpointInterceptor.PLACEHOLDER_BASE_URL}api/config/bootstrap?channel=debug"),
        )

        origin = "https://second.example.com"
        assertEquals(
            "https://second.example.com/api/auth/me?fresh=1",
            execute(interceptor, "${SystemServiceEndpointInterceptor.PLACEHOLDER_BASE_URL}api/auth/me?fresh=1"),
        )
    }

    @Test
    fun `absolute non placeholder url is unchanged`() {
        val interceptor = SystemServiceEndpointInterceptor { path -> "https://system.example.com$path" }

        assertEquals(
            "https://cdn.example.com/account/avatar.jpg?token=abc",
            execute(interceptor, "https://cdn.example.com/account/avatar.jpg?token=abc"),
        )
    }

    private fun execute(interceptor: Interceptor, url: String): String {
        var proceededUrl: String? = null
        val terminal = Interceptor { chain ->
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
