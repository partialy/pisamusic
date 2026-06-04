package cn.partialy.pm.network

/**
 * [CookieRequest.get] 的返回结果。
 *
 * @param cookieHeaderForNextRequest 默认会将本次响应里的 `Set-Cookie` 解析后与传入 cookie 合并；
 *   当调用方关闭响应 Cookie 合并时，该值只等于本次请求传入的 cookie（去首尾空白）。
 */
data class CookieHttpResult(
    val isSuccessful: Boolean,
    val code: Int,
    val body: String,
    val cookieHeaderForNextRequest: String,
)
