package cn.partialy.pm.network.config

import javax.inject.Inject
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import okhttp3.HttpUrl.Companion.toHttpUrl

/**
 * 把 Retrofit 的占位地址替换为配置下发后的实时地址。
 *
 * Retrofit 单例只负责描述接口，真正请求发出前再读取 [ConfigManager]，避免把启动时的
 * 回退地址永久固化到 Retrofit。使用 `@Url` 传入的绝对地址不会命中占位 host，因此保持原样；
 * 调用方通过 Retrofit `@Tag` 冻结的 bootstrap state 会继续传给网关签名拦截器。
 */
class RuntimeEndpointInterceptor internal constructor(
    private val endpointProvider: () -> ConfigManager.RuntimeEndpoints,
    private val runtimeStateProvider: (() -> ConfigManager.RuntimeBootstrapState)? = null,
) : Interceptor {
    @Inject
    constructor(configManager: ConfigManager) : this(
        endpointProvider = configManager::getEndpoints,
        runtimeStateProvider = configManager::getRuntimeBootstrapState,
    )

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val runtimeState = originalRequest.tag(ConfigManager.RuntimeBootstrapState::class.java)
            ?: runtimeStateProvider?.invoke()
        val taggedRequest = originalRequest.newBuilder()
            .apply {
                runtimeState?.let { tag(ConfigManager.RuntimeBootstrapState::class.java, it) }
            }
            .build()
        val endpoint = RuntimeEndpointKind.fromPlaceholder(originalRequest.url)
            ?: return chain.proceed(taggedRequest)
        val endpoints = runtimeState?.endpoints ?: endpointProvider()
        val targetBaseUrl = endpoint.resolve(endpoints).toHttpUrl()
        val rewrittenUrl = targetBaseUrl.mergeRelativeRequest(originalRequest.url)
        return chain.proceed(taggedRequest.newBuilder().url(rewrittenUrl).build())
    }

    private fun HttpUrl.mergeRelativeRequest(placeholderUrl: HttpUrl): HttpUrl {
        val basePath = encodedPath.ensureTrailingSlash()
        val requestPath = placeholderUrl.encodedPath.trimStart('/')
        return newBuilder()
            .encodedPath(basePath + requestPath)
            .encodedQuery(placeholderUrl.encodedQuery)
            .fragment(null)
            .build()
    }

    private fun String.ensureTrailingSlash(): String = if (endsWith('/')) this else "$this/"
}

internal enum class RuntimeEndpointKind(
    private val placeholderHost: String,
    private val endpointSelector: (ConfigManager.RuntimeEndpoints) -> String,
) {
    KG("kg.runtime.invalid", ConfigManager.RuntimeEndpoints::kgBaseUrl),
    WY("wy.runtime.invalid", ConfigManager.RuntimeEndpoints::wyBaseUrl),
    PROXY("proxy.runtime.invalid", ConfigManager.RuntimeEndpoints::proxyBaseUrl),
    KW("kw.runtime.invalid", ConfigManager.RuntimeEndpoints::kwBaseUrl),
    ;

    val placeholderBaseUrl: String = "https://$placeholderHost/"

    fun resolve(endpoints: ConfigManager.RuntimeEndpoints): String = endpointSelector(endpoints)

    companion object {
        fun fromPlaceholder(url: HttpUrl): RuntimeEndpointKind? =
            entries.firstOrNull { endpoint -> endpoint.placeholderHost == url.host }
    }
}
