package cn.partialy.pm.utils.localdata

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.util.concurrent.ConcurrentHashMap

data class AppConfigRecord(
    val key: String,
    val namespace: String,
    val schemaVersion: Int,
    val valueJson: String,
    val updatedAt: Long,
)

interface AppConfigStorage {
    fun get(key: String): AppConfigRecord?
    fun put(record: AppConfigRecord)
    fun delete(key: String)
    fun listByNamespace(namespace: String): List<AppConfigRecord>
}

private class SqliteAppConfigStorage(context: Context) : AppConfigStorage {
    private val dbHelper = LocalMusicDbOpenHelper.shared(context.applicationContext)

    override fun get(key: String): AppConfigRecord? {
        val db = dbHelper.readableDatabase
        db.query(
            TABLE_APP_CONFIG,
            COLUMNS,
            "$COL_KEY = ?",
            arrayOf(key),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            return AppConfigRecord(
                key = cursor.getString(0),
                namespace = cursor.getString(1),
                schemaVersion = cursor.getInt(2),
                valueJson = cursor.getString(3),
                updatedAt = cursor.getLong(4),
            )
        }
    }

    override fun put(record: AppConfigRecord) {
        val db = dbHelper.writableDatabase
        val values = ContentValues().apply {
            put(COL_KEY, record.key)
            put(COL_NAMESPACE, record.namespace)
            put(COL_SCHEMA_VERSION, record.schemaVersion)
            put(COL_VALUE_JSON, record.valueJson)
            put(COL_UPDATED_AT, record.updatedAt)
        }
        db.insertWithOnConflict(TABLE_APP_CONFIG, null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    override fun delete(key: String) {
        val db = dbHelper.writableDatabase
        db.delete(TABLE_APP_CONFIG, "$COL_KEY = ?", arrayOf(key))
    }

    override fun listByNamespace(namespace: String): List<AppConfigRecord> {
        val db = dbHelper.readableDatabase
        val result = mutableListOf<AppConfigRecord>()
        db.query(
            TABLE_APP_CONFIG,
            COLUMNS,
            "$COL_NAMESPACE = ?",
            arrayOf(namespace),
            null,
            null,
            "$COL_KEY ASC",
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result += AppConfigRecord(
                    key = cursor.getString(0),
                    namespace = cursor.getString(1),
                    schemaVersion = cursor.getInt(2),
                    valueJson = cursor.getString(3),
                    updatedAt = cursor.getLong(4),
                )
            }
        }
        return result
    }

    private companion object {
        const val TABLE_APP_CONFIG = "app_config"
        const val COL_KEY = "config_key"
        const val COL_NAMESPACE = "namespace"
        const val COL_SCHEMA_VERSION = "schema_version"
        const val COL_VALUE_JSON = "value_json"
        const val COL_UPDATED_AT = "updated_at"
        val COLUMNS = arrayOf(COL_KEY, COL_NAMESPACE, COL_SCHEMA_VERSION, COL_VALUE_JSON, COL_UPDATED_AT)
    }
}

/**
 * 面向全 App 的通用 SQLite KV 配置仓库（带线程安全内存缓存），
 * 同时支持按 namespace 归类与从旧 SharedPreferences 幂等迁入。
 */
class AppConfigStore(
    private val storage: AppConfigStorage,
    private val clockMs: () -> Long = System::currentTimeMillis,
) {
    private sealed class CacheSlot {
        data object Absent : CacheSlot()
        data class Present(val record: AppConfigRecord) : CacheSlot()
    }

    private val cache = ConcurrentHashMap<String, CacheSlot>()
    private val writeLock = Any()

    fun read(key: String): AppConfigRecord? {
        cache[key]?.let { slot ->
            return (slot as? CacheSlot.Present)?.record
        }
        val loaded = runCatching { storage.get(key) }.getOrNull()
        cache[key] = if (loaded != null) CacheSlot.Present(loaded) else CacheSlot.Absent
        return loaded
    }

    fun write(
        key: String,
        valueJson: String,
        namespace: String = DEFAULT_NAMESPACE,
        schemaVersion: Int = 1,
    ): AppConfigRecord {
        val record = AppConfigRecord(
            key = key,
            namespace = namespace.ifBlank { DEFAULT_NAMESPACE },
            schemaVersion = schemaVersion.coerceAtLeast(1),
            valueJson = valueJson,
            updatedAt = clockMs(),
        )
        synchronized(writeLock) {
            storage.put(record)
            cache[key] = CacheSlot.Present(record)
        }
        return record
    }

    fun delete(key: String) {
        synchronized(writeLock) {
            storage.delete(key)
            cache[key] = CacheSlot.Absent
        }
    }

    fun listByNamespace(namespace: String): List<AppConfigRecord> {
        val rows = runCatching { storage.listByNamespace(namespace) }.getOrDefault(emptyList())
        rows.forEach { cache[it.key] = CacheSlot.Present(it) }
        return rows
    }

    /**
     * 幂等迁移入口：若 SQLite 尚未记录该 key，则读取旧源（如 SharedPreferences）并写入 SQLite。
     * 后续将现有设置项迁入 app_config 时可直接复用本方法。
     */
    fun migrateOnce(
        key: String,
        namespace: String = DEFAULT_NAMESPACE,
        schemaVersion: Int = 1,
        legacyJsonProvider: () -> String?,
    ): AppConfigRecord? {
        read(key)?.let { return it }
        synchronized(writeLock) {
            read(key)?.let { return it }
            val legacyJson = runCatching { legacyJsonProvider() }.getOrNull()
                ?.takeIf { it.isNotBlank() }
                ?: return null
            val record = AppConfigRecord(
                key = key,
                namespace = namespace.ifBlank { DEFAULT_NAMESPACE },
                schemaVersion = schemaVersion.coerceAtLeast(1),
                valueJson = legacyJson,
                updatedAt = clockMs(),
            )
            storage.put(record)
            cache[key] = CacheSlot.Present(record)
            return record
        }
    }

    fun clearCache() {
        cache.clear()
    }

    companion object {
        const val DEFAULT_NAMESPACE = "default"

        @Volatile
        private var sharedInstance: AppConfigStore? = null

        fun shared(context: Context): AppConfigStore =
            sharedInstance ?: synchronized(this) {
                sharedInstance ?: AppConfigStore(SqliteAppConfigStorage(context.applicationContext))
                    .also { sharedInstance = it }
            }
    }
}
