package cn.partialy.pm.network

import cn.partialy.pm.network.cookie.MusicCookieManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * 在每次请求中自动附加持久化 Cookie。
 *
 * 普通业务接口只允许读取 SQLite / 内存中的登录 Cookie，忽略响应 `Set-Cookie`，避免不同设备或账号
 * 被服务端响应头污染。登录态变更应由登录流程或 WebView 导入显式写入 [MusicCookieManager]。
 */
class CookieSessionHttp(
    private val source: String,
    private val cookieManager: MusicCookieManager,
) {

    suspend fun get(
        url: String,
        params: Map<String, String?> = emptyMap(),
    ): CookieHttpResult = withContext(Dispatchers.IO) {
        getBlocking(url, params)
    }

    fun getBlocking(url: String, params: Map<String, String?> = emptyMap()): CookieHttpResult {
        val current = cookieManager.getCookie(source).cookie.trim().takeIf { it.isNotEmpty() }
        return CookieRequest.getBlocking(
            url = url,
            params = params,
            cookie = current,
            mergeResponseSetCookie = false,
        )
    }
}
