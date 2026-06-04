package cn.partialy.pm.network.cookie

import cn.partialy.pm.network.CookieRequest
import com.google.gson.Gson
import com.google.gson.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KugouLoginSessionFinalizerTest {

    private val gson = Gson()
    private val finalizer = KugouLoginSessionFinalizer()

    @Test
    fun buildSession_allowsEmptyVipToken() {
        val result = finalizer.buildSession(
            cookieHeaderAfterAuth = "kg_mid=mid",
            authPayload = KugouLoginAuthPayload(
                token = "token-from-qr",
                userid = "2287225139",
                nickname = "hello啊",
                avatarUrl = "http://example.com/avatar.jpg",
            ),
            tokenData = json(
                """
                {
                  "userid": 2287225139,
                  "token": "token-from-qr",
                  "vip_type": 0,
                  "vip_token": "",
                  "nickname": "hello啊",
                  "pic": "http://example.com/avatar.jpg"
                }
                """.trimIndent(),
            ),
        )

        val cookie = CookieRequest.parseCookieHeader(result.cookie)
        assertEquals("undefined", cookie["KUGOU_API_PLATFORM"])
        assertEquals("token-from-qr", cookie["token"])
        assertEquals("2287225139", cookie["userid"])
        assertEquals("0", cookie["vip_type"])
        assertEquals("", cookie["vip_token"])
        assertFalse(result.profile.isVip)
        assertEquals("hello啊", result.profile.nickname)
    }

    @Test
    fun buildSession_defaultsMissingVipTypeToZero() {
        val result = finalizer.buildSession(
            cookieHeaderAfterAuth = "",
            authPayload = KugouLoginAuthPayload(token = "tok", userid = "uid"),
            tokenData = json("""{"token":"tok","userid":"uid","vip_token":"vip"}"""),
        )

        val cookie = CookieRequest.parseCookieHeader(result.cookie)
        assertEquals("0", cookie["vip_type"])
        assertEquals("0", result.profile.vipType)
        assertFalse(result.profile.isVip)
    }

    @Test
    fun buildSession_fallsBackToLoginPayloadTokenAndUserid() {
        val result = finalizer.buildSession(
            cookieHeaderAfterAuth = "",
            authPayload = KugouLoginAuthPayload(
                token = "fallback-token",
                userid = "fallback-userid",
                nickname = "扫码昵称",
                avatarUrl = "http://example.com/scan.jpg",
            ),
            tokenData = json("""{"vip_type":2,"vip_token":"vip-token"}"""),
        )

        val cookie = CookieRequest.parseCookieHeader(result.cookie)
        assertEquals("fallback-token", cookie["token"])
        assertEquals("fallback-userid", cookie["userid"])
        assertEquals("2", cookie["vip_type"])
        assertTrue(result.profile.isVip)
        assertEquals("扫码昵称", result.profile.nickname)
        assertEquals("http://example.com/scan.jpg", result.profile.avatarUrl)
    }

    @Test
    fun buildSession_overridesSameNameCookieFields() {
        val result = finalizer.buildSession(
            cookieHeaderAfterAuth = "token=old; userid=old; vip_type=99; vip_token=old; keep=yes",
            authPayload = KugouLoginAuthPayload(token = "new-token", userid = "100"),
            tokenData = json(
                """
                {
                  "token": "new-token",
                  "userid": 100,
                  "vip_type": 1,
                  "vip_token": ""
                }
                """.trimIndent(),
            ),
        )

        val cookie = CookieRequest.parseCookieHeader(result.cookie)
        assertEquals("new-token", cookie["token"])
        assertEquals("100", cookie["userid"])
        assertEquals("1", cookie["vip_type"])
        assertEquals("", cookie["vip_token"])
        assertEquals("yes", cookie["keep"])
    }

    private fun json(raw: String): JsonObject =
        gson.fromJson(raw, JsonObject::class.java)
}
