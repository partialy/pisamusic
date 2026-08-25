package cn.partialy.pm.network

import cn.partialy.pm.network.cookie.MusicCookieManager
import cn.partialy.pm.network.config.ConfigManager

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

    internal fun getBlocking(
        target: ConfigManager.RuntimeUrlTarget,
        params: Map<String, String?> = emptyMap(),
    ): CookieHttpResult {
        val current = cookieManager.getCookie(source).cookie.trim().takeIf { it.isNotEmpty() }
        return CookieRequest.getBlocking(
            url = target.url,
            params = params,
            cookie = current,
            mergeResponseSetCookie = false,
            runtimeState = target.state,
        )
    }
}
