package cn.partialy.pm.network.gateway

import okhttp3.HttpUrl

internal object GatewaySignRuntime {
    private const val DEFAULT_GATEWAY_HOST = "gateway.partialy.cn"
    private const val DEFAULT_SIGN_SECRET = "partialypartialypartialypartialy"
    private const val DEFAULT_SIGN_AS = "yixivip"

    @Volatile
    private var currentConfig = GatewaySignConfig(
        secret = DEFAULT_SIGN_SECRET,
        asValue = DEFAULT_SIGN_AS,
    )

    @Volatile
    private var endpointPrefixes: Set<String> = emptySet()

    fun update(config: GatewaySignConfig, endpointUrls: Collection<String>) {
        currentConfig = config.normalized()
        endpointPrefixes = endpointUrls
            .mapNotNull { it.trim().takeIf(String::isNotEmpty) }
            .map { normalizePrefix(it) }
            .toSet()
    }

    fun current(): GatewaySignConfig = currentConfig

    fun shouldSign(url: HttpUrl): Boolean {
        if (url.host.equals(DEFAULT_GATEWAY_HOST, ignoreCase = true)) return true
        val raw = url.toString()
        return endpointPrefixes.any { raw.startsWith(it, ignoreCase = true) }
    }

    private fun normalizePrefix(url: String): String = url
}

internal data class GatewaySignConfig(
    val secret: String,
    val asValue: String,
) {
    fun normalized(): GatewaySignConfig =
        GatewaySignConfig(
            secret = secret.takeIf { it.isNotBlank() } ?: "partialypartialypartialypartialy",
            asValue = asValue.takeIf { it.isNotBlank() } ?: "yixivip",
        )
}
