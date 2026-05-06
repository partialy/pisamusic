package cn.partialy.pm.network

import cn.partialy.pm.network.cookie.PersistedUserCookieStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * 在每次请求中自动附加持久化 Cookie，并在响应含 `Set-Cookie` 时用 [CookieRequest] 的规则合并、
 * 延长过期后写回 [PersistedUserCookieStore]。
 */
class CookieSessionHttp(
    private val store: PersistedUserCookieStore,
) {

    suspend fun get(
        url: String,
        params: Map<String, String?> = emptyMap(),
    ): CookieHttpResult = withContext(Dispatchers.IO) {
        getBlocking(url, params)
    }

    fun getBlocking(url: String, params: Map<String, String?> = emptyMap()): CookieHttpResult {
        val current = store.getCookie().trim().takeIf { it.isNotEmpty() }
        val result = CookieRequest.getBlocking(url, params, current)
        val next = result.cookieHeaderForNextRequest.trim()
        if (next.isNotEmpty() && next != current) {
            store.updateFromMergedHeader(next)
        }
        return result
    }
}
