package cn.partialy.pm.network.gateway

import cn.partialy.pm.network.config.ConfigManager
import okhttp3.HttpUrl

internal object GatewaySignRuntime {
    private const val DEFAULT_GATEWAY_HOST = "gateway.partialy.cn"
    private const val DEFAULT_SIGN_SECRET = "partialypartialypartialypartialy"
    private const val DEFAULT_SIGN_AS = "yixivip"

    @Volatile
    private var runtimeStateProvider: (() -> ConfigManager.RuntimeBootstrapState)? = null

    fun bind(stateProvider: () -> ConfigManager.RuntimeBootstrapState) {
        runtimeStateProvider = stateProvider
    }

    fun snapshot(): ConfigManager.RuntimeBootstrapState? = runtimeStateProvider?.invoke()

    fun current(snapshot: ConfigManager.RuntimeBootstrapState? = snapshot()): GatewaySignConfig {
        val gatewaySign = snapshot?.gatewaySign
        return GatewaySignConfig(
            secret = gatewaySign?.secret ?: DEFAULT_SIGN_SECRET,
            asValue = gatewaySign?.asValue ?: DEFAULT_SIGN_AS,
        ).normalized()
    }

    fun shouldSign(
        url: HttpUrl,
        snapshot: ConfigManager.RuntimeBootstrapState? = snapshot(),
    ): Boolean {
        if (url.host.equals(DEFAULT_GATEWAY_HOST, ignoreCase = true)) return true
        val raw = url.toString()
        return snapshot?.gatewayEndpointPrefixes.orEmpty()
            .any { raw.startsWith(it, ignoreCase = true) }
    }
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
