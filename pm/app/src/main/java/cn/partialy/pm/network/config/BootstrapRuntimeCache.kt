package cn.partialy.pm.network.config

import android.content.Context
import android.content.SharedPreferences
import cn.partialy.pm.model.BootstrapConfigData
import cn.partialy.pm.model.BootstrapEndpoints
import cn.partialy.pm.model.GatewaySignConfig
import org.json.JSONObject

/**
 * 最近一次在线成功下发的 Bootstrap 运行时配置及主动本地模式标记的持久化抽象。
 * 供进程被系统回收后跳过启动页直接重建 Activity / Service 时秒恢复音乐网关地址与签名配置。
 */
interface BootstrapRuntimeCache {
    fun readBootstrap(): BootstrapConfigData?
    fun saveBootstrap(data: BootstrapConfigData)
    fun readExplicitLocalMode(): Boolean
    fun setExplicitLocalMode(enabled: Boolean)
}

class NoOpBootstrapRuntimeCache : BootstrapRuntimeCache {
    override fun readBootstrap(): BootstrapConfigData? = null
    override fun saveBootstrap(data: BootstrapConfigData) = Unit
    override fun readExplicitLocalMode(): Boolean = false
    override fun setExplicitLocalMode(enabled: Boolean) = Unit
}

class BootstrapRuntimePrefs private constructor(
    private val preferences: SharedPreferences,
) : BootstrapRuntimeCache {
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE),
    )

    override fun readBootstrap(): BootstrapConfigData? = synchronized(PROCESS_LOCK) {
        val raw = preferences.getString(KEY_BOOTSTRAP_JSON, null)?.takeIf { it.isNotBlank() }
            ?: return@synchronized null
        return@synchronized runCatching {
            val root = JSONObject(raw)
            val endpointsObj = root.optJSONObject("endpoints") ?: return@synchronized null
            val endpoints = BootstrapEndpoints(
                kgBaseUrl = endpointsObj.optString("kgBaseUrl").trim(),
                wyBaseUrl = endpointsObj.optString("wyBaseUrl").trim(),
                proxyBaseUrl = endpointsObj.optString("proxyBaseUrl").trim(),
                kwBaseUrl = endpointsObj.optString("kwBaseUrl").trim(),
                kgSongUrl = endpointsObj.optString("kgSongUrl").trim(),
                wySongUrl = endpointsObj.optString("wySongUrl").trim(),
                wySongUrlV1 = endpointsObj.optString("wySongUrlV1").trim(),
            )
            if (!endpoints.hasAllHttpUrls()) return@synchronized null
            val signObj = root.optJSONObject("gatewaySign")
            val sign = GatewaySignConfig(
                secret = signObj?.optString("secret").orEmpty().ifBlank { DEFAULT_SECRET },
                `as` = signObj?.optString("as").orEmpty().ifBlank { DEFAULT_AS },
            )
            BootstrapConfigData(
                version = root.optString("version").takeIf { it.isNotBlank() },
                updatedAt = if (root.has("updatedAt") && !root.isNull("updatedAt")) root.optLong("updatedAt") else null,
                endpoints = endpoints,
                gatewaySign = sign,
            )
        }.getOrNull()
    }

    override fun saveBootstrap(data: BootstrapConfigData) {
        if (!data.endpoints.hasAllHttpUrls()) return
        val json = JSONObject().apply {
            data.version?.let { put("version", it) }
            data.updatedAt?.let { put("updatedAt", it) }
            put(
                "endpoints",
                JSONObject().apply {
                    put("kgBaseUrl", data.endpoints.kgBaseUrl.trim())
                    put("wyBaseUrl", data.endpoints.wyBaseUrl.trim())
                    put("proxyBaseUrl", data.endpoints.proxyBaseUrl.trim())
                    put("kwBaseUrl", data.endpoints.kwBaseUrl.trim())
                    put("kgSongUrl", data.endpoints.kgSongUrl.trim())
                    put("wySongUrl", data.endpoints.wySongUrl.trim())
                    put("wySongUrlV1", data.endpoints.wySongUrlV1.trim())
                },
            )
            put(
                "gatewaySign",
                JSONObject().apply {
                    put("secret", data.gatewaySign.secret.ifBlank { DEFAULT_SECRET })
                    put("as", data.gatewaySign.`as`.ifBlank { DEFAULT_AS })
                },
            )
        }.toString()
        synchronized(PROCESS_LOCK) {
            preferences.edit().putString(KEY_BOOTSTRAP_JSON, json).commit()
        }
    }

    override fun readExplicitLocalMode(): Boolean = synchronized(PROCESS_LOCK) {
        preferences.getBoolean(KEY_EXPLICIT_LOCAL_MODE, false)
    }

    override fun setExplicitLocalMode(enabled: Boolean) {
        synchronized(PROCESS_LOCK) {
            preferences.edit().putBoolean(KEY_EXPLICIT_LOCAL_MODE, enabled).commit()
        }
    }

    private fun BootstrapEndpoints.hasAllHttpUrls(): Boolean = listOf(
        kgBaseUrl,
        wyBaseUrl,
        proxyBaseUrl,
        kwBaseUrl,
        kgSongUrl,
        wySongUrl,
        wySongUrlV1,
    ).all { url -> url.startsWith("http://") || url.startsWith("https://") }

    private companion object {
        val PROCESS_LOCK = Any()
        const val PREFS_NAME = "bootstrap_runtime_prefs"
        const val KEY_BOOTSTRAP_JSON = "bootstrap_json"
        const val KEY_EXPLICIT_LOCAL_MODE = "explicit_local_mode"
        const val DEFAULT_SECRET = "partialypartialypartialypartialy"
        const val DEFAULT_AS = "yixivip"
    }
}
