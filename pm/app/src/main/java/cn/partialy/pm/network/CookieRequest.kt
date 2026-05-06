package cn.partialy.pm.network

import cn.partialy.pm.network.gateway.GatewaySignRuntime
import cn.partialy.pm.network.gateway.GatewaySigner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Cookie
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * 带可控 `Cookie` 请求头的简易 HTTP 客户端（GET + query）。
 *
 * 需**自动携带并回写本地持久化 Cookie**时，使用 [CookieSessionHttp]（由
 * [cn.partialy.pm.network.cookie.KugouCookieRepository] / [cn.partialy.pm.network.cookie.WyCookieRepository] 持有）。
 *
 * 用法：
 * ```
 * val result = CookieRequest.get("https://...", mapOf("a" to "1"), cookieHeader)
 * // result.cookieHeaderForNextRequest：响应 Set-Cookie 已把过期拉到约 50 年后并与原 cookie 合并
 * ```
 *
 * 传入的 cookie 形如：`a=1; b=2`（与 WebView `CookieManager.getCookie` 一致）。
 */
object CookieRequest {

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    /**
     * @param url 完整 URL
     * @param params 查询参数（value 为 null 时跳过该 key）
     * @param cookie 可选，非空则设置请求头 `Cookie: ...`
     * @param extraHeaders 额外请求头（如 Referer、User-Agent；与 [cookie] 可同时存在）
     */
    suspend fun get(
        url: String,
        params: Map<String, String?> = emptyMap(),
        cookie: String? = null,
        extraHeaders: Map<String, String> = emptyMap(),
    ): CookieHttpResult = withContext(Dispatchers.IO) {
        getBlocking(url, params, cookie, extraHeaders)
    }

    /**
     * 同步 GET；调用方需自行保证已在后台线程（与 [get] 行为一致）。
     */
    fun getBlocking(
        url: String,
        params: Map<String, String?> = emptyMap(),
        cookie: String? = null,
        extraHeaders: Map<String, String> = emptyMap(),
    ): CookieHttpResult {
        val httpUrl = url.toHttpUrlOrNull()
            ?: throw IllegalArgumentException("Invalid url: $url")
        val urlBuilder = httpUrl.newBuilder()
        for ((k, v) in params) {
            if (v != null) urlBuilder.addQueryParameter(k, v)
        }
        val unsignedUrl = urlBuilder.build()
        val finalUrl = if (GatewaySignRuntime.shouldSign(unsignedUrl)) {
            unsignedUrl.newBuilder()
                .setQueryParameter("res-dec", "1")
                .build()
        } else {
            unsignedUrl
        }
        val reqBuilder = Request.Builder().url(finalUrl).get()
        if (GatewaySignRuntime.shouldSign(finalUrl)) {
            val timestamp = System.currentTimeMillis().toString()
            val nonce = UUID.randomUUID().toString().replace("-", "")
            val signConfig = GatewaySignRuntime.current()
            val signature = GatewaySigner.buildSignature(
                method = "GET",
                url = finalUrl,
                bodyBytes = ByteArray(0),
                timestamp = timestamp,
                nonce = nonce,
                asValue = signConfig.asValue,
                secret = signConfig.secret,
            )
            reqBuilder.header("t", timestamp)
            reqBuilder.header("n", nonce)
            reqBuilder.header("s", signature)
        }
        cookie?.trim()?.takeIf { it.isNotEmpty() }?.let { reqBuilder.header("Cookie", it) }
        for ((k, v) in extraHeaders) {
            if (k.isNotBlank() && v.isNotBlank()) reqBuilder.header(k, v)
        }
        val request = reqBuilder.build()
        client.newCall(request).execute().use { response ->
            val bodyStr = response.body?.string().orEmpty()
            val nextCookie = mergeWithSetCookieExtendedExpiry(
                httpUrl = finalUrl,
                previousCookieHeader = cookie,
                response = response,
            )
            return CookieHttpResult(
                isSuccessful = response.isSuccessful,
                code = response.code,
                body = bodyStr,
                cookieHeaderForNextRequest = nextCookie,
            )
        }
    }

    /**
     * 仅做字符串解析：把 `a=1; b=2` 拆成 map（按分号分段，每段只按第一个 `=` 分割）。
     */
    fun parseCookieHeader(header: String): LinkedHashMap<String, String> {
        val map = LinkedHashMap<String, String>()
        mergeCookieHeaderIntoMap(header, map)
        return map
    }

    /**
     * 把 [Set-Cookie] 行解析为 [Cookie]，并把过期时间改为约 50 年后（用于持久化或拼回请求头）。
     */
    fun parseSetCookieWithExtendedExpiry(httpUrl: HttpUrl, setCookieLine: String): Cookie? {
        val parsed = Cookie.parse(httpUrl, setCookieLine) ?: return null
        return rebuildCookieWithExpiry(parsed, fiftyYearsEpochMillis())
    }

    /**
     * 解析响应中的 `Set-Cookie`，并把每条 cookie 的过期时间改为约 50 年后。
     * 若需写入 [android.webkit.CookieManager]，可将每条转为 Set-Cookie 格式字符串再 [android.webkit.CookieManager.setCookie]。
     */
    fun extendedSetCookies(httpUrl: HttpUrl, response: Response): List<Cookie> {
        val expireAt = fiftyYearsEpochMillis()
        return response.headers("Set-Cookie").mapNotNull { line ->
            Cookie.parse(httpUrl, line)?.let { rebuildCookieWithExpiry(it, expireAt) }
        }
    }

    /**
     * 将多条 `Set-Cookie` 解析、延长过期，再与已有 `Cookie` 请求头按 name 合并，生成新的 `Cookie` 请求头字符串。
     */
    fun mergeSetCookiesIntoCookieHeader(
        httpUrl: HttpUrl,
        previousCookieHeader: String?,
        setCookieLines: List<String>,
    ): String {
        val map = LinkedHashMap<String, String>()
        mergeCookieHeaderIntoMap(previousCookieHeader, map)
        val expireAt = fiftyYearsEpochMillis()
        for (line in setCookieLines) {
            val parsed = Cookie.parse(httpUrl, line) ?: continue
            val extended = rebuildCookieWithExpiry(parsed, expireAt)
            map[extended.name] = extended.value
        }
        return map.entries.joinToString("; ") { "${it.key}=${it.value}" }
    }

    private fun mergeWithSetCookieExtendedExpiry(
        httpUrl: HttpUrl,
        previousCookieHeader: String?,
        response: Response,
    ): String {
        val lines = response.headers("Set-Cookie")
        if (lines.isEmpty()) {
            return previousCookieHeader?.trim().orEmpty()
        }
        return mergeSetCookiesIntoCookieHeader(httpUrl, previousCookieHeader, lines)
    }

    private fun mergeCookieHeaderIntoMap(header: String?, target: MutableMap<String, String>) {
        if (header.isNullOrBlank()) return
        for (part in header.split(';')) {
            val trimmed = part.trim()
            if (trimmed.isEmpty()) continue
            val eq = trimmed.indexOf('=')
            if (eq <= 0) continue
            val name = trimmed.substring(0, eq).trim()
            val value = trimmed.substring(eq + 1).trim()
            if (name.isNotEmpty()) target[name] = value
        }
    }

    private fun fiftyYearsEpochMillis(): Long =
        ZonedDateTime.now(ZoneOffset.UTC).plusYears(50).toInstant().toEpochMilli()

    private fun rebuildCookieWithExpiry(c: Cookie, expiresAt: Long): Cookie {
        val b = Cookie.Builder()
            .name(c.name)
            .value(c.value)
            .path(c.path)
            .expiresAt(expiresAt)
        if (c.hostOnly) {
            b.hostOnlyDomain(c.domain)
        } else {
            b.domain(c.domain)
        }
        if (c.secure) b.secure()
        if (c.httpOnly) b.httpOnly()
        return b.build()
    }
}
