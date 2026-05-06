package cn.partialy.pm.network.kg

import okhttp3.Interceptor
import okhttp3.Response

/**
 * 在查询参数中附加 `dfid`（若已存在则不再重复添加）。
 */
class DfidInterceptor(
    private val holder: DfidHolder,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val dfid = holder.dfid
        if (dfid.isNullOrBlank()) {
            return chain.proceed(original)
        }
        val url = original.url
        if (url.queryParameter("dfid") != null) {
            return chain.proceed(original)
        }
        val newUrl = url.newBuilder().addQueryParameter("dfid", dfid).build()
        return chain.proceed(original.newBuilder().url(newUrl).build())
    }
}
