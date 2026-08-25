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

    override fun read(): CachedDiscoveryDocument? = synchronized(PROCESS_LOCK) {
        val rawJson = preferences.getString(KEY_RAW_JSON, null)?.takeIf { it.isNotBlank() }
            ?: return@synchronized null
        val configVersion = preferences.getInt(KEY_CONFIG_VERSION, INVALID_VERSION)
        if (configVersion <= 0) return@synchronized null
        CachedDiscoveryDocument(rawJson = rawJson, configVersion = configVersion)
    }

    override fun saveIfNotOlder(rawJson: String, configVersion: Int): Boolean = synchronized(PROCESS_LOCK) {
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
        /** SharedPreferences 进程内共享；所有本类实例必须共用同一读改写锁。 */
        val PROCESS_LOCK = Any()
        const val PREFS_NAME = "service_discovery"
        const val KEY_RAW_JSON = "raw_json"
        const val KEY_CONFIG_VERSION = "config_version"
        const val INVALID_VERSION = -1
    }
}
