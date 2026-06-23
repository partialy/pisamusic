package cn.partialy.pm.fault

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackFaultSanitizerTest {
    @Test
    fun `敏感查询参数会脱敏并保留 nonce 以外的普通参数`() {
        val url = "https://example.com/play?id=123&token=secret&s=signature&quality=320".toHttpUrl()
        val safe = PlaybackFaultSanitizer.sanitizeUrl(url)

        assertTrue(safe.contains("id=123"))
        assertTrue(safe.contains("quality=320"))
        assertFalse(safe.contains("secret"))
        assertFalse(safe.contains("signature"))
    }

    @Test
    fun `超长文本按字段上限截断`() {
        assertEquals("1234", PlaybackFaultSanitizer.limit("123456", 4))
        assertEquals("123", PlaybackFaultSanitizer.errorMessage("123"))
        assertEquals(
            PlaybackFaultSanitizer.MAX_ERROR_LENGTH,
            PlaybackFaultSanitizer.errorMessage("x".repeat(PlaybackFaultSanitizer.MAX_ERROR_LENGTH + 10)).length,
        )
    }

    @Test
    fun `本地日志映射上传 DTO 不携带上传状态`() {
        val log = PlaybackFaultLog(
            id = "id",
            scene = "play_url",
            failureType = "empty_url",
            occurredAt = 1L,
            methodName = "method",
            requestMethod = "GET",
            requestUrl = "https://example.com",
            requestParamsJson = "{}",
            nonceId = "nonce",
            responseCode = 200,
            responseBody = "{}",
            resolvedUrl = "",
            errorType = "",
            errorMessage = "empty",
            stackTrace = "",
            songSource = "KG",
            songId = "song",
            quality = "320",
            isUpload = true,
            uploadedAt = 2L,
        ).toPayload()

        assertEquals("id", log.clientLogId)
        assertEquals("nonce", log.nonceId)
        assertEquals("320", log.quality)
    }
}
