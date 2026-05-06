package cn.partialy.pm.network.cache

class Cache(private val timeout: Long) {
    private val cache = mutableMapOf<String, CacheEntry>()

    data class CacheEntry(
        val data: Any,
        val timestamp: Long
    )

    @Suppress("UNCHECKED_CAST")
    fun <T> get(key: String): T? {
        val entry = cache[key] ?: return null
        if (System.currentTimeMillis() - entry.timestamp > timeout) {
            cache.remove(key)
            return null
        }
        return entry.data as? T
    }

    fun set(key: String, value: Any) {
        cache[key] = CacheEntry(value, System.currentTimeMillis())
    }
} 