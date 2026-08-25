package cn.partialy.pm.network.discovery

import javax.inject.Inject
import javax.inject.Singleton
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response

/** 在请求发出前，把系统服务占位地址改写到 discovery 当前选中的 API origin。 */
@Singleton
class SystemServiceEndpointInterceptor internal constructor(
    private val resolveApiUrl: (String) -> String,
) : Interceptor {
    @Inject
    constructor(serviceDiscoveryManager: ServiceDiscoveryManager) : this(serviceDiscoveryManager::resolveApiUrl)

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.url.host != PLACEHOLDER_HOST) return chain.proceed(request)

        val resolved = resolveApiUrl(request.url.encodedPath).toHttpUrl()
            .newBuilder()
            .encodedQuery(request.url.encodedQuery)
            .fragment(null)
            .build()
        return chain.proceed(request.newBuilder().url(resolved).build())
    }

    companion object {
        internal const val PLACEHOLDER_HOST = "system.runtime.invalid"
        const val PLACEHOLDER_BASE_URL = "https://$PLACEHOLDER_HOST/"
    }
}
