package cn.partialy.pm.network

/**
 * [CookieRequest.get] 的返回结果。
 *
 * @param cookieHeaderForNextRequest 将本次响应里的 `Set-Cookie` 解析后，把过期时间改为约 50 年，
 *   再与本次请求传入的 cookie 按 name 合并（后者覆盖同名），得到的 `Cookie` 请求头字符串；
 *   无新 Set-Cookie 时与传入的 cookie 一致（去首尾空白）。
 */
data class CookieHttpResult(
    val isSuccessful: Boolean,
    val code: Int,
    val body: String,
    val cookieHeaderForNextRequest: String,
)
