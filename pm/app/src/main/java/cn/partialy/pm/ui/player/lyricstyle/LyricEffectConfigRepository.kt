package cn.partialy.pm.ui.player.lyricstyle

import android.content.Context
import cn.partialy.pm.utils.localdata.AppConfigStore

/**
 * 主歌词特效与帧率配置仓库：底层落库 SQLite app_config，热路径走内存快照缓存。
 */
class LyricEffectConfigStore(
    private val configStore: AppConfigStore,
) {
    @Volatile
    private var cached: LyricEffectConfig? = null
    private val lock = Any()

    fun read(): LyricEffectConfig {
        cached?.let { return it }
        synchronized(lock) {
            cached?.let { return it }
            val record = configStore.read(CONFIG_KEY)
            val parsed = LyricEffectConfig.fromJson(record?.valueJson)
            cached = parsed
            return parsed
        }
    }

    fun write(config: LyricEffectConfig): LyricEffectConfig {
        val normalized = config.normalized()
        synchronized(lock) {
            configStore.write(
                key = CONFIG_KEY,
                valueJson = normalized.toJson(),
                namespace = NAMESPACE,
                schemaVersion = SCHEMA_VERSION,
            )
            cached = normalized
        }
        return normalized
    }

    fun update(transform: (LyricEffectConfig) -> LyricEffectConfig): LyricEffectConfig {
        synchronized(lock) {
            val next = transform(read()).normalized()
            configStore.write(
                key = CONFIG_KEY,
                valueJson = next.toJson(),
                namespace = NAMESPACE,
                schemaVersion = SCHEMA_VERSION,
            )
            cached = next
            return next
        }
    }

    fun resetStyle(styleId: LyricEffectStyleId): LyricEffectConfig =
        update { it.resetStyle(styleId) }

    fun invalidateCache() {
        cached = null
    }

    companion object {
        const val CONFIG_KEY = "lyric.effect_config"
        const val NAMESPACE = "lyric"
        const val SCHEMA_VERSION = 1
    }
}

object LyricEffectConfigRepository {
    @Volatile
    private var sharedStore: LyricEffectConfigStore? = null

    private fun store(context: Context): LyricEffectConfigStore =
        sharedStore ?: synchronized(this) {
            sharedStore ?: LyricEffectConfigStore(AppConfigStore.shared(context.applicationContext))
                .also { sharedStore = it }
        }

    internal fun sharedStore(context: Context): LyricEffectConfigStore = store(context)

    fun read(context: Context): LyricEffectConfig = store(context).read()

    fun write(context: Context, config: LyricEffectConfig): LyricEffectConfig =
        store(context).write(config)

    fun update(
        context: Context,
        transform: (LyricEffectConfig) -> LyricEffectConfig,
    ): LyricEffectConfig = store(context).update(transform)

    fun resetStyle(context: Context, styleId: LyricEffectStyleId): LyricEffectConfig =
        store(context).resetStyle(styleId)

    fun invalidateCache() {
        sharedStore?.invalidateCache()
    }
}
