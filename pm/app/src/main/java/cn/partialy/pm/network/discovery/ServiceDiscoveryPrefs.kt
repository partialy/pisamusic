package cn.partialy.pm.network.discovery

import android.content.Context
import android.content.SharedPreferences

/** 缓存只保留服务发现原文与对应版本，具体字段必须在读取时从原文重新校验。 */
data class CachedDiscoveryDocument(
    val rawJson: String,
    val configVersion: Int,
)

interface ServiceDiscoveryCache {
    fun read(): CachedDiscoveryDocument?

    /** 同版本允许刷新原文，低版本不得覆盖已有缓存。 */
    fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean
}

class ServiceDiscoveryPrefs private constructor(
    private val preferences: SharedPreferences,
) : ServiceDiscoveryCache {
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE),
    )

    private val lock = Any()

    override fun read(): CachedDiscoveryDocument? = synchronized(lock) {
        val rawJson = preferences.getString(KEY_RAW_JSON, null)?.takeIf { it.isNotBlank() }
            ?: return@synchronized null
        val configVersion = preferences.getInt(KEY_CONFIG_VERSION, INVALID_VERSION)
        if (configVersion <= 0) return@synchronized null
        CachedDiscoveryDocument(rawJson = rawJson, configVersion = configVersion)
    }

    override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean = synchronized(lock) {
        require(rawJson.isNotBlank()) { "服务发现原文不能为空" }
        require(configVersion > 0) { "服务发现版本必须为正数" }
        val cachedVersion = preferences.getInt(KEY_CONFIG_VERSION, INVALID_VERSION)
        if (cachedVersion > configVersion) return@synchronized false
        preferences.edit()
            .putString(KEY_RAW_JSON, rawJson)
            .putInt(KEY_CONFIG_VERSION, configVersion)
            .commit()
    }

    private companion object {
        const val PREFS_NAME = "service_discovery"
        const val KEY_RAW_JSON = "raw_json"
        const val KEY_CONFIG_VERSION = "config_version"
        const val INVALID_VERSION = -1
    }
}
