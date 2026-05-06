package cn.partialy.pm.network.gateway

import java.nio.charset.StandardCharsets
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Test

class GatewaySignerTest {
    @Test
    fun canonicalQuerySortsAndKeepsResponseDecryptFlag() {
        val url = "https://gateway.partialy.cn/kg-service/search" +
            "?type=special&enc=1&keywords=a%20b&n=old&s=old&t=old&res-dec=1"

        assertEquals(
            "keywords=a+b&res-dec=1&type=special",
            GatewaySigner.canonicalQuery(url.toHttpUrl()),
        )
    }

    @Test
    fun canonicalQueryUsesJavaUrlEncodeRules() {
        val url = "https://gateway.partialy.cn/kg-service/search" +
            "?keywords=%E7%BD%97%E7%94%9F%E9%97%A8%20test%2Bplus&mark=~!*'()"

        assertEquals(
            "keywords=%E7%BD%97%E7%94%9F%E9%97%A8+test%2Bplus&mark=%7E%21*%27%28%29",
            GatewaySigner.canonicalQuery(url.toHttpUrl()),
        )
    }

    @Test
    fun canonicalQuerySortsDuplicateValues() {
        val url = "https://gateway.partialy.cn/wy-service/foo?b=2&a=z&a=a"

        assertEquals(
            "a=a&a=z&b=2",
            GatewaySigner.canonicalQuery(url.toHttpUrl()),
        )
    }

    @Test
    fun emptyBodyHashIsEmptyString() {
        assertEquals("", GatewaySigner.sha256Base64(ByteArray(0)))
    }

    @Test
    fun postBodyHashUsesActualBytes() {
        val body = "{\"amount\":100}".toByteArray(StandardCharsets.UTF_8)

        assertEquals(
            "TUu+Wcaq0iRCzeGZpqil8DRAX814+1qBwk7ySd4cRfE=",
            GatewaySigner.sha256Base64(body),
        )
    }

    @Test
    fun buildsExpectedSignature() {
        val url = "https://gateway.partialy.cn/kg-service/search" +
            "?type=special&keywords=a%20b&res-dec=1"

        val signature = GatewaySigner.buildSignature(
            method = "GET",
            url = url.toHttpUrl(),
            bodyBytes = ByteArray(0),
            timestamp = "1700000000000",
            nonce = "abcdef",
            asValue = "yixivip",
            secret = "test-secret",
        )

        assertEquals("1JlpR/+p8WwArz+i+sMlXuYDWQ8U/N7py1keCyX4XzM=", signature)
    }
}
